import AVFoundation
import CoreAudio
import CoreMedia
import Foundation

/// System-audio capture via CoreAudio process taps — the modern,
/// audio-only path on macOS 14.4+.
///
/// Phase-8k: replaces the prior ScreenCaptureKit-based implementation.
///
/// **Why this rewrite.** SCStream + `capturesAudio=true` triggers the
/// macOS "Screen & System Audio Recording" TCC permission, which is
/// the same prompt screen-recorder apps see — Apple labels it as
/// granting access to "the content of your screen and audio". Users
/// see that as far more invasive than what we actually do (we never
/// look at pixels). On macOS 14.4 Apple introduced
/// `AudioHardwareCreateProcessTap`, which has its own dedicated
/// audio-only TCC entry — "System Audio Recording Only" — with a
/// matching prompt that doesn't mention screens at all. Switching
/// APIs gets us the smaller permission with no functional change in
/// what we actually capture.
///
/// **Architecture.** Mirrors the pre-Phase-7.6 Rust
/// `media_capture` crate, which is the version known to work on
/// AirPods / Bluetooth headphones.
///   1. Build a `CATapDescription` with no excluded processes →
///      global tap of all system audio output.
///   2. `AudioHardwareCreateProcessTap` to create the tap. THIS is
///      what triggers the macOS permission dialog on first call.
///   3. Build an aggregate device that contains:
///        - a sub-tap (our process tap) — supplies the system
///          audio frames
///        - the default INPUT device (mic) as the sole sub-device
///          AND as the clock — the mic is continuously producing
///          samples during a meeting (user is talking into it),
///          which is what keeps the aggregate's IO loop firing.
///          A silent / output-only sub-device leaves the IO loop
///          idle on Bluetooth setups (`io callbacks=0` symptom).
///        - the default OUTPUT device named as `MainSubDevice`
///          (label only — not in the SubDeviceList) for
///          bookkeeping
///      `kAudioAggregateDeviceTapAutoStartKey = 1` makes the tap
///      driven the moment we open an IO proc.
///   4. `activateAudioDevice` on input + output — attaches a no-op
///      IO proc and calls `AudioDeviceStart` on each. Forces the
///      underlying device clocks to keep pumping. Critical for
///      Bluetooth (AirPods on A2DP/HFP let their clocks idle when
///      no audio is currently playing). Activation IO procs use
///      `nil` queue to run on CoreAudio's internal IO thread —
///      sharing a serial dispatch queue with the main aggregate
///      IO proc kept the aggregate idle on Bluetooth.
///   5. `AudioDeviceCreateIOProcIDWithBlock` → IO callback dispatched
///      on a dedicated `userInteractive` queue. The aggregate
///      delivers a 2-buffer list per callback: `mBuffers[0]` is
///      the mic (we drop it — `LiveAudioCapture` captures mic
///      separately), `mBuffers[1]` is the tap. We wrap the tap
///      buffer in an `AVAudioPCMBuffer` and forward via
///      `onBuffer`. Same shape as Rust's `extract_input_only`,
///      just with the indices swapped (we keep tap, drop mic;
///      Rust kept mic, dropped tap).
///
/// `excludesCurrentProcessAudio`-equivalent: process taps don't
/// natively offer this, but `MeetingCoordinator` consumes our buffers
/// alongside `LiveAudioCapture` (mic) and DTLN-AEC subtracts the
/// system reference from the mic. Our own UI sounds are pretty quiet
/// in practice and the user has system audio routed to headphones
/// during meetings anyway, so feedback hasn't been an issue.
///
/// Threading: the IO callback runs on `processingQueue`. We forward
/// the converted PCM buffer on that same queue — caller's `onBuffer`
/// must be cheap (Parakeet's `streamAudio(_:)` and the writer's
/// `appendSystem(_:)` are both non-blocking enqueues).
final class SystemAudioCapture: NSObject, @unchecked Sendable {
  /// Called for every captured **system audio** packet (the tap's
  /// data — Zoom/Meet output, music, etc.). Format depends on what
  /// the aggregate device hands us — typically 48 kHz Float32 stereo
  /// interleaved.
  var onSystemBuffer: ((AVAudioPCMBuffer) -> Void)?

  /// Called for every captured **mic** packet — the aggregate's
  /// input sub-device data, split out of the same IO callback as
  /// the system stream. Format depends on the input device's native
  /// rate + channel count (queried on first packet). This replaces
  /// `LiveAudioCapture` (AVAudioEngine) for the on-by-default path.
  ///
  /// **Why share one CoreAudio source.** Pre-Phase-7.5 the Rust
  /// `media_capture` crate had a single aggregate that delivered
  /// mic + tap in one IO callback. When Phase-8k rewrote the audio
  /// path in Swift the mic moved to AVAudioEngine and the system
  /// audio stayed on the aggregate — two separate CoreAudio
  /// consumers of the same Bluetooth input device. CoreAudio
  /// silently refused to pump the aggregate's IO loop in that
  /// contended state on AirPods (`raw IO callbacks=0` even with
  /// every API call returning noErr). Going back to one consumer
  /// fixes it; we just split the buffer list ourselves.
  var onMicBuffer: ((AVAudioPCMBuffer) -> Void)?

  // MARK: - State

  private var tapID: AudioObjectID = 0
  private var aggregateID: AudioObjectID = 0
  private var procID: AudioDeviceIOProcID?
  /// Tap (system audio) format. Queried via
  /// `kAudioTapPropertyFormat` once at start; doesn't change mid-
  /// run. Typically 48 kHz Float32 stereo interleaved.
  private var streamFormat: AVAudioFormat?
  /// Mic (input sub-device) format. Lazily resolved on the first
  /// IO callback because the input device's stream layout (channel
  /// count interleaved vs not) is most reliably read from the
  /// actual `AudioBuffer` we receive. Sample rate comes from
  /// `kAudioDevicePropertyNominalSampleRate` on the input device,
  /// captured at start time.
  private var micFormat: AVAudioFormat?
  /// Cached input device nominal sample rate. Captured at start
  /// time so the first IO callback can build `micFormat` without
  /// hitting CoreAudio synchronously from the IO thread.
  private var inputDeviceSampleRate: Double = 48_000
  private var isRunning = false

  // Device-activation IO procs. Critical for Bluetooth output
  // capture: just naming the input device as the aggregate's
  // clock isn't enough — the underlying device's CoreAudio
  // clock needs to actually be RUNNING for the aggregate's IO
  // loop to fire. Attaching a dummy IO proc and calling
  // `AudioDeviceStart` on each forces the clock to pump samples.
  // Mirrors the pattern in the pre-Phase-7.6 Rust media_capture
  // crate (which is the version that worked on AirPods).
  private var inputActivationProcID: AudioDeviceIOProcID?
  private var inputActivationDeviceID: AudioObjectID = 0
  private var outputActivationProcID: AudioDeviceIOProcID?
  private var outputActivationDeviceID: AudioObjectID = 0

  // Diagnostic counters — reset on `start()`, summarised on
  // `stop()`. Tells us "IO callback never fired" vs "callback
  // fires but every packet is empty" vs "callback fires with
  // real frames" without per-buffer log spam.
  //
  // `rawIOCallbackCount` increments on EVERY raw IO block call
  // (before the isRunning guard) so we can tell apart "callback
  // never fires" (= aggregate clock dead) from "callback fires
  // but we filter it" (= isRunning timing race). `ioCallbackCount`
  // increments inside `handleInputBuffer`, after the guard.
  private var rawIOCallbackCount: Int = 0
  private var ioCallbackCount: Int = 0
  private var droppedZeroFrameCount: Int = 0
  private var droppedConvertFailCount: Int = 0
  private var emittedBufferCount: Int = 0
  private var emittedFrameCount: Int64 = 0
  private static let firstBuffersToLog: Int = 3

  private let processingQueue = DispatchQueue(
    label: "com.polymind.system-audio-capture",
    qos: .userInteractive
  )

  // MARK: - Public API

  /// Start the CoreAudio process tap pipeline. Async to keep the
  /// signature drop-in compatible with the prior ScreenCaptureKit
  /// implementation (the actual CoreAudio calls are synchronous).
  ///
  /// Throws on:
  ///   - Permission denied (`AudioHardwareCreateProcessTap` returns
  ///     non-zero status; macOS surfaces the prompt the first time
  ///     and returns the cached deny on subsequent calls).
  ///   - No default output device (rare — happens only when no
  ///     audio device is present at all).
  ///   - Aggregate-device creation failure (almost always a stale
  ///     UID from a prior crashed run; macOS cleans these up on
  ///     reboot).
  ///
  /// Idempotent — calling repeatedly while running is a no-op.
  func start() async throws {
    if isRunning { return }

    NSLog("[SystemAudioCapture] starting (CoreAudio process tap)")

    // 1. Build a global tap description (no excluded processes →
    //    captures the full system mix).
    let description = CATapDescription(stereoGlobalTapButExcludeProcesses: [])
    description.uuid = UUID()
    description.isPrivate = true
    description.isExclusive = false

    // 2. Create the tap. This is the call that triggers the macOS
    //    permission dialog. On first run the user sees:
    //    "PolyMind would like to access system audio". Subsequent
    //    runs return immediately if granted, or fail if denied.
    var newTapID: AudioObjectID = 0
    let tapStatus = AudioHardwareCreateProcessTap(description, &newTapID)
    guard tapStatus == noErr else {
      throw NSError(
        domain: "SystemAudioCapture",
        code: Int(tapStatus),
        userInfo: [
          NSLocalizedDescriptionKey:
            "AudioHardwareCreateProcessTap failed (\(tapStatus)) — System Audio Recording permission likely denied"
        ]
      )
    }
    self.tapID = newTapID

    // 3. Resolve the default output AND input devices.
    //    - Input (the mic): the aggregate's sole SUB-DEVICE AND
    //      its clock. Mic samples are continuously produced
    //      during a meeting (user is talking into it), which is
    //      what keeps the aggregate's IO loop firing reliably
    //      across all device configurations including Bluetooth
    //      headphones. Empirically required: a silent /
    //      output-only sub-device leaves the loop idle (`io
    //      callbacks=0` in the stop summary, even with
    //      activations succeeding). Mirrors the Rust
    //      media_capture pattern.
    //    - Output: named on the aggregate as MainSubDevice — a
    //      bookkeeping label, NOT in the SubDeviceList.
    //
    //    `handleInputBuffer` discards `mBuffers[0]` (mic) and
    //    forwards only `mBuffers[1]` (tap). We need the mic in
    //    the SubDeviceList for clocking, but we don't want its
    //    samples in our system-audio output (LiveAudioCapture
    //    handles mic separately).
    let outputDeviceID: AudioObjectID
    let outputDeviceUID: String
    let inputDeviceID: AudioObjectID
    let inputDeviceUID: String
    do {
      outputDeviceID = try defaultOutputDeviceID()
      outputDeviceUID = try deviceUID(deviceID: outputDeviceID)
      inputDeviceID = try defaultInputDeviceID()
      inputDeviceUID = try deviceUID(deviceID: inputDeviceID)
    } catch {
      AudioHardwareDestroyProcessTap(newTapID)
      self.tapID = 0
      throw error
    }
    NSLog(
      "[SystemAudioCapture] aggregate: input=%@ (MainSub + clock + sub-device), output=%@ (NOT referenced by aggregate)",
      inputDeviceUID,
      outputDeviceUID
    )

    // 4. Aggregate device. The built-in mic is the sole sub-device,
    //    the clock device, AND the MainSubDevice — three keys, one
    //    consistent device. The previous "MainSub = output, sub-list
    //    = [input]" config (mirroring the Rust crate's literal call)
    //    is technically invalid per Apple's docs: MainSubDevice MUST
    //    be one of the sub-devices in SubDeviceList. CoreAudio
    //    silently rejected this misconfig on AirPods (`raw IO
    //    callbacks=0` despite every API call returning noErr) — the
    //    aggregate was created but never scheduled.
    //
    //    The user's output device (AirPods etc.) is intentionally
    //    NOT referenced by the aggregate. The process tap captures
    //    the system mix BEFORE it's routed to any output device,
    //    so we don't need to anchor the aggregate to the user's
    //    output. AirPods can be in HFP, A2DP, idle, A/B switching —
    //    none of it matters to the aggregate's clock or IO loop.
    //
    //    `IsPrivate=1` keeps the aggregate out of system audio
    //    device listings; `TapAutoStart=1` makes the tap pump
    //    samples the moment we attach an IO proc.
    let aggregateUID = UUID().uuidString
    let aggregateDict: [String: Any] = [
      kAudioAggregateDeviceNameKey as String: "PolyMindSystemAudioTap",
      kAudioAggregateDeviceUIDKey as String: aggregateUID,
      kAudioAggregateDeviceMainSubDeviceKey as String: inputDeviceUID,
      kAudioAggregateDeviceClockDeviceKey as String: inputDeviceUID,
      kAudioAggregateDeviceIsPrivateKey as String: 1,
      kAudioAggregateDeviceIsStackedKey as String: 0,
      kAudioAggregateDeviceTapAutoStartKey as String: 1,
      kAudioAggregateDeviceSubDeviceListKey as String: [
        [kAudioSubDeviceUIDKey as String: inputDeviceUID]
      ],
      kAudioAggregateDeviceTapListKey as String: [
        [kAudioSubTapUIDKey as String: description.uuid.uuidString]
      ]
    ]

    var newAggregateID: AudioObjectID = 0
    let aggStatus = AudioHardwareCreateAggregateDevice(
      aggregateDict as CFDictionary, &newAggregateID)
    guard aggStatus == noErr else {
      AudioHardwareDestroyProcessTap(newTapID)
      self.tapID = 0
      throw NSError(
        domain: "SystemAudioCapture",
        code: Int(aggStatus),
        userInfo: [
          NSLocalizedDescriptionKey:
            "AudioHardwareCreateAggregateDevice failed (\(aggStatus))"
        ]
      )
    }
    self.aggregateID = newAggregateID

    // 4b. Warm-up read of the aggregate's nominal sample rate.
    //     Mirrors what `AggregateDeviceManager::start_capture` does
    //     in the Rust media_capture crate — querying this property
    //     on the freshly-created aggregate appears to nudge
    //     CoreAudio into fully initialising the device's internal
    //     state before we start attaching IO procs. Without it,
    //     the aggregate's IO loop sometimes never fires (especially
    //     when the underlying sub-device is Bluetooth). Failures
    //     are non-fatal — we just log and proceed.
    var aggSampleRate: Float64 = 0
    var aggSampleRateSize = UInt32(MemoryLayout<Float64>.size)
    var aggSampleRateAddress = AudioObjectPropertyAddress(
      mSelector: kAudioDevicePropertyNominalSampleRate,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain
    )
    let aggSampleRateStatus = AudioObjectGetPropertyData(
      newAggregateID,
      &aggSampleRateAddress,
      0,
      nil,
      &aggSampleRateSize,
      &aggSampleRate
    )
    NSLog(
      "[SystemAudioCapture] aggregate nominal sample rate: %.0f Hz (status=%d)",
      aggSampleRate,
      aggSampleRateStatus
    )

    // 5. Determine the stream format the aggregate device will
    //    deliver. We query the tap's own format (the aggregate
    //    forwards frames in this format on its input scope). On
    //    failure we fall back to the conventional 48 kHz Float32
    //    stereo non-interleaved layout that process taps default
    //    to.
    self.streamFormat = streamFormatForTap(tapID: newTapID)
      ?? AVAudioFormat(
        standardFormatWithSampleRate: 48_000,
        channels: 2
      )
    guard self.streamFormat != nil else {
      AudioHardwareDestroyAggregateDevice(newAggregateID)
      AudioHardwareDestroyProcessTap(newTapID)
      self.aggregateID = 0
      self.tapID = 0
      throw NSError(
        domain: "SystemAudioCapture",
        code: -1,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Could not resolve a usable stream format for the aggregate device"
        ]
      )
    }

    // 5b. Activate the input AND output devices by attaching a
    //     no-op IO proc to each and starting them. This forces
    //     each device's CoreAudio clock to actually pump samples.
    //
    //     - Input activation is defensive: in practice the mic is
    //       already being driven by `LiveAudioCapture`'s
    //       AVAudioEngine, which started a moment earlier in
    //       `MeetingCoordinator`. `AudioDeviceStart` ref-counts,
    //       so a second start is harmless. The redundancy guards
    //       the case where mic capture failed but we still want
    //       the system tap going — without it the aggregate's
    //       clock device (input) would have no clock signal.
    //
    //     - Output activation is the load-bearing one. Bluetooth
    //       output devices (AirPods on A2DP/HFP) let their clock
    //       idle when no audio is currently playing through them.
    //       Since the output is in our SubDeviceList, the
    //       aggregate's IO loop pulls from it; an idle output
    //       clock starves the aggregate. Attaching a no-op IO
    //       proc + `AudioDeviceStart` forces the output's clock
    //       to keep ticking. This is the missing piece from the
    //       initial Phase-8k Swift rewrite that the original Rust
    //       media_capture crate had — see tap_audio.rs
    //       `activate_audio_device`.
    //
    //     Failures here are non-fatal (we proceed without
    //     activation; on non-Bluetooth setups the aggregate
    //     usually clocks anyway).
    if let inputProc = activateAudioDevice(deviceID: inputDeviceID, label: "input (built-in mic)") {
      self.inputActivationProcID = inputProc
      self.inputActivationDeviceID = inputDeviceID
    }
    // Output activation deliberately removed: AirPods (or whatever
    // the user's output is) is no longer in the aggregate at all,
    // so its clock pumping is irrelevant. The tap captures the
    // pre-route system mix; nothing about output routing affects
    // it. Activating an unrelated device just creates a no-op IO
    // proc that has to be torn down later — pure overhead.

    // 5c. Post-activation property reads. Rust calls
    //     `get_aggregate_device_stats()` a SECOND time inside its
    //     `start()` (after the constructor's first call AND after
    //     activations) and also reads the input device's nominal
    //     sample rate. These reads have no functional return value
    //     for us — they're property queries — but their side
    //     effect of touching the device's CoreAudio object appears
    //     to nudge the aggregate's IO loop awake on Bluetooth.
    //     Without them in Swift we observed `raw IO callbacks=0`
    //     even with output+input activations both succeeding.
    //     Mirroring Rust exactly here is cheap insurance.
    var aggSampleRate2: Float64 = 0
    var aggSampleRate2Size = UInt32(MemoryLayout<Float64>.size)
    var aggSampleRate2Address = AudioObjectPropertyAddress(
      mSelector: kAudioDevicePropertyNominalSampleRate,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain
    )
    _ = AudioObjectGetPropertyData(
      newAggregateID,
      &aggSampleRate2Address,
      0,
      nil,
      &aggSampleRate2Size,
      &aggSampleRate2
    )
    var inputSampleRate: Float64 = 0
    var inputSampleRateSize = UInt32(MemoryLayout<Float64>.size)
    var inputSampleRateAddress = AudioObjectPropertyAddress(
      mSelector: kAudioDevicePropertyNominalSampleRate,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain
    )
    _ = AudioObjectGetPropertyData(
      inputDeviceID,
      &inputSampleRateAddress,
      0,
      nil,
      &inputSampleRateSize,
      &inputSampleRate
    )
    NSLog(
      "[SystemAudioCapture] post-activation rates — aggregate=%.0f Hz, input device=%.0f Hz",
      aggSampleRate2,
      inputSampleRate
    )

    // Cache the input device's sample rate so `handleInputBuffer`
    // can build the mic format on the first packet without doing
    // a synchronous CoreAudio property read from the IO thread.
    // Falls back to the aggregate's rate if the input read returned
    // 0 (rare — happens only when the device went away mid-setup).
    if inputSampleRate > 0 {
      self.inputDeviceSampleRate = inputSampleRate
    } else if aggSampleRate2 > 0 {
      self.inputDeviceSampleRate = aggSampleRate2
    } else {
      self.inputDeviceSampleRate = 48_000
    }

    // Reset diagnostic counters before the IO proc starts firing.
    rawIOCallbackCount = 0
    ioCallbackCount = 0
    droppedZeroFrameCount = 0
    droppedConvertFailCount = 0
    emittedBufferCount = 0
    emittedFrameCount = 0

    // 6. Attach an IO proc to the aggregate device. The block fires
    //    every audio packet (~10 ms) on `processingQueue`. We
    //    capture `self` weakly to avoid retain cycles if the caller
    //    drops the capture instance mid-flight.
    // Pass `nil` for the queue → CoreAudio dispatches the IO block
    // on its internal real-time IO thread instead of our user
    // DispatchQueue. After 10 builds where every aggregate
    // configuration produced `raw IO callbacks=0`, this is the one
    // remaining variable to test: whether our serial DispatchQueue
    // was the reason CoreAudio refused to schedule the IO callback
    // in the spawned child-process context. The cost is that
    // `handleInputBuffer` now runs on a real-time priority thread,
    // so heap allocations there (AVAudioPCMBuffer init) can cause
    // priority inversion on heavily loaded systems — but the
    // alternative is no audio at all.
    var newProcID: AudioDeviceIOProcID?
    let createStatus = AudioDeviceCreateIOProcIDWithBlock(
      &newProcID,
      newAggregateID,
      nil
    ) { [weak self] _, inInputData, _, _, _ in
      guard let self = self else { return }
      // Atomic-enough for diagnostic purposes. CoreAudio's IO thread
      // serialises calls to a single IO proc, so an unprotected `+=`
      // here is safe even though we're off our DispatchQueue.
      self.rawIOCallbackCount += 1
      guard self.isRunning else { return }
      self.handleInputBuffer(inInputData)
    }

    guard createStatus == noErr, let unwrappedProcID = newProcID else {
      AudioHardwareDestroyAggregateDevice(newAggregateID)
      AudioHardwareDestroyProcessTap(newTapID)
      self.aggregateID = 0
      self.tapID = 0
      throw NSError(
        domain: "SystemAudioCapture",
        code: Int(createStatus),
        userInfo: [
          NSLocalizedDescriptionKey:
            "AudioDeviceCreateIOProcIDWithBlock failed (\(createStatus))"
        ]
      )
    }
    self.procID = unwrappedProcID

    // 7. Start the IO proc. `TapAutoStartKey=1` on the aggregate
    //    means the tap stream starts pumping samples here too.
    let startStatus = AudioDeviceStart(newAggregateID, unwrappedProcID)
    guard startStatus == noErr else {
      AudioDeviceDestroyIOProcID(newAggregateID, unwrappedProcID)
      AudioHardwareDestroyAggregateDevice(newAggregateID)
      AudioHardwareDestroyProcessTap(newTapID)
      self.procID = nil
      self.aggregateID = 0
      self.tapID = 0
      throw NSError(
        domain: "SystemAudioCapture",
        code: Int(startStatus),
        userInfo: [
          NSLocalizedDescriptionKey:
            "AudioDeviceStart failed (\(startStatus))"
        ]
      )
    }

    self.isRunning = true
    let sd = self.streamFormat?.streamDescription.pointee
    NSLog(
      "[SystemAudioCapture] capture started — format: %.0f Hz, %u ch, %u bytes/frame",
      sd?.mSampleRate ?? 0,
      sd?.mChannelsPerFrame ?? 0,
      sd?.mBytesPerFrame ?? 0
    )
  }

  /// Attach a no-op IO proc to a device and start it. The proc
  /// does nothing (literally an empty block) but its presence +
  /// `AudioDeviceStart` forces CoreAudio to keep the device's
  /// clock active. Used during meeting setup to wake the input
  /// (mic) and output (speakers/AirPods) devices so the aggregate
  /// device built on top of them actually gets a clock heartbeat.
  ///
  /// **Queue must be nil**, not `processingQueue`. The Rust
  /// `media_capture` reference impl passes NULL here on purpose —
  /// activation IO procs need to be on CoreAudio's internal real-
  /// time IO thread, not a user dispatch queue. With them on the
  /// same serial queue as the main aggregate IO proc, CoreAudio
  /// observed never to pump the aggregate (`io callbacks=0` in
  /// the stop summary, even though every API call returns noErr
  /// and the device is "running"). Letting CoreAudio own the
  /// activation thread fixes the AirPods/Bluetooth case.
  ///
  /// Returns the proc ID for later cleanup; nil on failure (logged
  /// but non-fatal — the meeting proceeds without the activation,
  /// which works fine for non-Bluetooth setups but loses Bluetooth
  /// system-audio capture).
  private func activateAudioDevice(
    deviceID: AudioObjectID,
    label: String
  ) -> AudioDeviceIOProcID? {
    var procID: AudioDeviceIOProcID?
    let createStatus = AudioDeviceCreateIOProcIDWithBlock(
      &procID,
      deviceID,
      nil
    ) { _, _, _, _, _ in
      // No-op. The block's existence + AudioDeviceStart is what
      // keeps the device's clock pumping. Runs on CoreAudio's
      // internal IO thread (we pass nil for the queue above).
    }
    guard createStatus == noErr, let unwrappedProcID = procID else {
      NSLog(
        "[SystemAudioCapture] %@ device activation: create IO proc failed (%d) — proceeding without",
        label,
        createStatus
      )
      return nil
    }
    let startStatus = AudioDeviceStart(deviceID, unwrappedProcID)
    guard startStatus == noErr else {
      NSLog(
        "[SystemAudioCapture] %@ device activation: AudioDeviceStart failed (%d) — proceeding without",
        label,
        startStatus
      )
      AudioDeviceDestroyIOProcID(deviceID, unwrappedProcID)
      return nil
    }
    NSLog("[SystemAudioCapture] %@ device activation: running", label)
    return unwrappedProcID
  }

  /// Stop the IO proc and tear down the aggregate device + tap.
  /// Safe to call repeatedly. Async to preserve the prior signature
  /// — the underlying calls are synchronous.
  func stop() async {
    guard isRunning else { return }
    isRunning = false
    onMicBuffer = nil
    onSystemBuffer = nil
    micFormat = nil

    // Diagnostic: surface how the capture actually ran. Helps tell
    // apart "IO callback never fired" (ioCallbackCount=0) from
    // "callback fires but every packet is empty" (count > 0 but
    // emittedFrameCount=0). Logged before the teardown so the
    // numbers reach the log even if cleanup throws.
    NSLog(
      "[SystemAudioCapture] stop summary — raw IO callbacks=%d, gated callbacks=%d, emitted buffers=%d, frames=%lld, dropped (zero-frame=%d, convert-fail=%d)",
      rawIOCallbackCount,
      ioCallbackCount,
      emittedBufferCount,
      emittedFrameCount,
      droppedZeroFrameCount,
      droppedConvertFailCount
    )

    // Tear down the device-activation IO procs (input + output).
    // Order matters less than completeness — both must come down
    // before the aggregate, otherwise the underlying devices stay
    // in "started" state with orphaned procs that leak until the
    // next reboot.
    if let inProc = inputActivationProcID, inputActivationDeviceID != 0 {
      _ = AudioDeviceStop(inputActivationDeviceID, inProc)
      _ = AudioDeviceDestroyIOProcID(inputActivationDeviceID, inProc)
    }
    inputActivationProcID = nil
    inputActivationDeviceID = 0
    if let outProc = outputActivationProcID, outputActivationDeviceID != 0 {
      _ = AudioDeviceStop(outputActivationDeviceID, outProc)
      _ = AudioDeviceDestroyIOProcID(outputActivationDeviceID, outProc)
    }
    outputActivationProcID = nil
    outputActivationDeviceID = 0

    if let procID = procID {
      // AudioDeviceStop / DestroyIOProcID may fail if the device is
      // already being torn down (e.g. the user changed default
      // output device under us). Errors here are non-fatal — we
      // proceed with the rest of the cleanup either way.
      let stopStatus = AudioDeviceStop(aggregateID, procID)
      if stopStatus != noErr {
        NSLog(
          "[SystemAudioCapture] AudioDeviceStop returned %d (non-fatal)",
          stopStatus
        )
      }
      let destroyStatus = AudioDeviceDestroyIOProcID(aggregateID, procID)
      if destroyStatus != noErr {
        NSLog(
          "[SystemAudioCapture] AudioDeviceDestroyIOProcID returned %d (non-fatal)",
          destroyStatus
        )
      }
    }
    procID = nil

    if aggregateID != 0 {
      let status = AudioHardwareDestroyAggregateDevice(aggregateID)
      if status != noErr {
        NSLog(
          "[SystemAudioCapture] AudioHardwareDestroyAggregateDevice returned %d (non-fatal)",
          status
        )
      }
      aggregateID = 0
    }

    if tapID != 0 {
      let status = AudioHardwareDestroyProcessTap(tapID)
      if status != noErr {
        NSLog(
          "[SystemAudioCapture] AudioHardwareDestroyProcessTap returned %d (non-fatal)",
          status
        )
      }
      tapID = 0
    }

    streamFormat = nil
    NSLog("[SystemAudioCapture] capture stopped")
  }

  // MARK: - IO callback

  /// Split one IO callback's `AudioBufferList` into independent
  /// **mic** and **system** PCM buffers, forwarding each via the
  /// corresponding callback. Drops a stream silently on conversion
  /// failure — a dropped packet is a brief (~10 ms) gap in live
  /// transcription, not a crash; the next packet starts clean.
  ///
  /// **Buffer-list layout.** The aggregate device delivers a fixed
  /// 2-buffer list (matches what the Rust `media_capture` crate
  /// asserted on):
  ///   - `mBuffers[0]` — the input sub-device (mic). Forwarded via
  ///     `onMicBuffer`. Format = input device's native rate, channel
  ///     count taken from the buffer itself, Float32 interleaved.
  ///   - `mBuffers[1]` — the tap (system audio). Forwarded via
  ///     `onSystemBuffer`. Format = tap's published format
  ///     (`kAudioTapPropertyFormat`) — typically 48 kHz Float32
  ///     stereo interleaved.
  ///
  /// Splitting here means callers get two independent streams from
  /// a single CoreAudio source — same architecture as 0.26.9x Rust.
  /// AVAudioEngine no longer runs in parallel on the same input
  /// device, which is what was preventing the aggregate's IO loop
  /// from firing on Bluetooth (AirPods).
  private func handleInputBuffer(_ inputData: UnsafePointer<AudioBufferList>) {
    ioCallbackCount += 1

    guard let tapFormat = self.streamFormat else {
      if ioCallbackCount == 1 {
        NSLog(
          "[SystemAudioCapture] first IO callback dropped — streamFormat nil"
        )
      }
      return
    }

    let inputAbl = UnsafeMutableAudioBufferListPointer(
      UnsafeMutablePointer(mutating: inputData)
    )
    guard inputAbl.count >= 2 else {
      droppedZeroFrameCount += 1
      if droppedZeroFrameCount == 1 {
        NSLog(
          "[SystemAudioCapture] first IO callback has unexpected layout — buffers=%d (expected ≥2)",
          inputAbl.count
        )
      }
      return
    }

    let tapBuffer = inputAbl[1]

    // Forward system (tap) only. `mBuffers[0]` is the built-in
    // mic data — we put the built-in mic in the aggregate purely
    // as a stable 48 kHz clock source; its samples aren't useful
    // (the user's actual mic is on AirPods, captured separately
    // by `LiveAudioCapture`). Discarding the built-in mic samples
    // here keeps `onMicBuffer` a no-op even if it's wired by the
    // caller — the caller should be using `LiveAudioCapture`
    // instead.
    guard let onSys = onSystemBuffer else {
      droppedConvertFailCount += 1
      return
    }
    let tapBytesPerFrame = max(tapFormat.streamDescription.pointee.mBytesPerFrame, 1)
    let tapFrameCount = tapBuffer.mDataByteSize / tapBytesPerFrame
    guard tapFrameCount > 0 else {
      droppedZeroFrameCount += 1
      if droppedZeroFrameCount == 1 {
        NSLog(
          "[SystemAudioCapture] first zero-frame tap packet — tapRate=%.0f, buffers=%d",
          tapFormat.streamDescription.pointee.mSampleRate,
          inputAbl.count
        )
      }
      return
    }
    guard
      let pcm = AVAudioPCMBuffer(
        pcmFormat: tapFormat,
        frameCapacity: AVAudioFrameCount(tapFrameCount)
      )
    else {
      droppedConvertFailCount += 1
      return
    }
    pcm.frameLength = AVAudioFrameCount(tapFrameCount)
    let dstAbl = UnsafeMutableAudioBufferListPointer(pcm.mutableAudioBufferList)
    if let dst = dstAbl.first,
       let srcData = tapBuffer.mData,
       let dstData = dst.mData
    {
      let bytesToCopy = min(Int(tapBuffer.mDataByteSize), Int(dst.mDataByteSize))
      memcpy(dstData, srcData, bytesToCopy)
    }
    onSys(pcm)
    emittedBufferCount += 1
    emittedFrameCount += Int64(tapFrameCount)
    if emittedBufferCount <= Self.firstBuffersToLog {
      NSLog(
        "[SystemAudioCapture] tap buffer #%d — %u frames, tap ch=%u, builtin mic ch=%u",
        emittedBufferCount,
        tapFrameCount,
        tapBuffer.mNumberChannels,
        inputAbl[0].mNumberChannels
      )
    }
  }

  // MARK: - CoreAudio plumbing

  /// Resolve the system's current default output device. The
  /// aggregate names this as its `MainSubDevice` for bookkeeping —
  /// the actual clock + sub-device is the input (mic). Reason: this
  /// is what the Rust media_capture crate did before the Swift
  /// rewrite, and it's what fixes Bluetooth output capture
  /// (output device's clock idles when nothing's playing through
  /// it; mic clock is always pumping during a meeting).
  private func defaultOutputDeviceID() throws -> AudioObjectID {
    return try defaultDeviceID(
      selector: kAudioHardwarePropertyDefaultOutputDevice,
      label: "output"
    )
  }

  /// Resolve the BUILT-IN microphone, NOT the system's current
  /// default input device. We use this as the aggregate's clock
  /// source + sole sub-device.
  ///
  /// **Why not the default input.** When the user has Bluetooth
  /// earphones connected (AirPods etc.) macOS sets the BT mic as
  /// the default input. In HFP mode that mic runs at 16 kHz. The
  /// process tap publishes at 48 kHz. An aggregate built on the
  /// BT mic inherits the 16 kHz rate; CoreAudio then has a 3×
  /// rate mismatch with the tap and silently refuses to pump the
  /// IO loop (`raw IO callbacks=0` in stop summary, every API
  /// call returns noErr — perfect failure).
  ///
  /// The built-in mic is always 48 kHz Float32 and its clock is
  /// always stable, regardless of what BT devices are connected.
  /// We never actually USE its samples — `handleInputBuffer`
  /// discards `mBuffers[0]` (the sub-device data) and forwards
  /// only `mBuffers[1]` (the tap). The built-in mic is here purely
  /// to anchor the aggregate's clock at a sample rate that
  /// matches the tap.
  ///
  /// The user's *actual* mic recording (AirPods etc.) still goes
  /// through `LiveAudioCapture`'s AVAudioEngine, which is a
  /// separate consumer of a separate device — no contention.
  ///
  /// On the rare Mac with no built-in mic (some Mac Studios,
  /// rack-mounted setups) we fall back to `defaultInputDeviceID`
  /// — which means the original Bluetooth bug is still possible
  /// in that one configuration, but it's a tiny audience.
  private func defaultInputDeviceID() throws -> AudioObjectID {
    if let builtIn = builtInInputDeviceID() {
      return builtIn
    }
    NSLog(
      "[SystemAudioCapture] built-in mic not found — falling back to default input"
    )
    return try defaultDeviceID(
      selector: kAudioHardwarePropertyDefaultInputDevice,
      label: "input"
    )
  }

  private func defaultDeviceID(
    selector: AudioObjectPropertySelector,
    label: String
  ) throws -> AudioObjectID {
    var deviceID: AudioObjectID = 0
    var size = UInt32(MemoryLayout<AudioObjectID>.size)
    var address = AudioObjectPropertyAddress(
      mSelector: selector,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain
    )
    let status = AudioObjectGetPropertyData(
      AudioObjectID(kAudioObjectSystemObject),
      &address,
      0,
      nil,
      &size,
      &deviceID
    )
    guard status == noErr, deviceID != 0 else {
      throw NSError(
        domain: "SystemAudioCapture",
        code: Int(status),
        userInfo: [
          NSLocalizedDescriptionKey:
            "Could not resolve default \(label) device (\(status))"
        ]
      )
    }
    return deviceID
  }

  /// Enumerate all hardware audio devices and return the first one
  /// with `kAudioDevicePropertyTransportType` equal to
  /// `kAudioDeviceTransportTypeBuiltIn` AND a non-empty input
  /// stream configuration (so we get the built-in MICROPHONE, not
  /// the built-in speakers — both report the same transport type).
  /// Returns nil on failure (devices unreadable, or no built-in
  /// mic on this Mac — rare).
  private func builtInInputDeviceID() -> AudioObjectID? {
    var listSize: UInt32 = 0
    var listAddress = AudioObjectPropertyAddress(
      mSelector: kAudioHardwarePropertyDevices,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain
    )
    var status = AudioObjectGetPropertyDataSize(
      AudioObjectID(kAudioObjectSystemObject),
      &listAddress,
      0,
      nil,
      &listSize
    )
    guard status == noErr, listSize > 0 else { return nil }

    let count = Int(listSize) / MemoryLayout<AudioObjectID>.size
    var devices = [AudioObjectID](repeating: 0, count: count)
    status = AudioObjectGetPropertyData(
      AudioObjectID(kAudioObjectSystemObject),
      &listAddress,
      0,
      nil,
      &listSize,
      &devices
    )
    guard status == noErr else { return nil }

    for device in devices {
      // Filter by transport type = built-in.
      var transportType: UInt32 = 0
      var transportSize = UInt32(MemoryLayout<UInt32>.size)
      var transportAddress = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyTransportType,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain
      )
      let transportStatus = AudioObjectGetPropertyData(
        device,
        &transportAddress,
        0,
        nil,
        &transportSize,
        &transportType
      )
      guard transportStatus == noErr,
            transportType == kAudioDeviceTransportTypeBuiltIn else {
        continue
      }

      // Filter by has-input: read input-scope stream config and
      // confirm there's at least one input channel. Built-in
      // SPEAKERS also report transport=BuiltIn but have zero
      // input channels — this is what tells them apart from the
      // built-in mic.
      var streamConfigSize: UInt32 = 0
      var streamConfigAddress = AudioObjectPropertyAddress(
        mSelector: kAudioDevicePropertyStreamConfiguration,
        mScope: kAudioObjectPropertyScopeInput,
        mElement: kAudioObjectPropertyElementMain
      )
      let sizeStatus = AudioObjectGetPropertyDataSize(
        device,
        &streamConfigAddress,
        0,
        nil,
        &streamConfigSize
      )
      guard sizeStatus == noErr, streamConfigSize > 0 else { continue }

      let bufferList = UnsafeMutablePointer<AudioBufferList>.allocate(
        capacity: Int(streamConfigSize)
      )
      defer { bufferList.deallocate() }
      let configStatus = AudioObjectGetPropertyData(
        device,
        &streamConfigAddress,
        0,
        nil,
        &streamConfigSize,
        bufferList
      )
      guard configStatus == noErr else { continue }

      let abl = UnsafeMutableAudioBufferListPointer(bufferList)
      let totalChannels = abl.reduce(0) { $0 + Int($1.mNumberChannels) }
      if totalChannels > 0 {
        if let uid = try? deviceUID(deviceID: device) {
          NSLog(
            "[SystemAudioCapture] built-in mic resolved: id=%u uid=%@ channels=%d",
            device,
            uid,
            totalChannels
          )
        }
        return device
      }
    }
    return nil
  }

  /// Pull the persistent UID string from a CoreAudio device. Used
  /// to wire the device into the aggregate device dictionary. UIDs
  /// survive route changes (unlike `AudioObjectID`s) which makes
  /// them the right thing to store.
  private func deviceUID(deviceID: AudioObjectID) throws -> String {
    var uid: Unmanaged<CFString>?
    var size = UInt32(MemoryLayout<Unmanaged<CFString>?>.size)
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioDevicePropertyDeviceUID,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain
    )
    let status = AudioObjectGetPropertyData(
      deviceID,
      &address,
      0,
      nil,
      &size,
      &uid
    )
    guard status == noErr, let uidValue = uid?.takeRetainedValue() else {
      throw NSError(
        domain: "SystemAudioCapture",
        code: Int(status),
        userInfo: [
          NSLocalizedDescriptionKey:
            "Could not resolve device UID for \(deviceID) (\(status))"
        ]
      )
    }
    return uidValue as String
  }

  /// Inspect the tap object directly to learn its native format.
  /// Process taps publish a `kAudioTapPropertyFormat` we can read
  /// the moment they're created — this is the most reliable way to
  /// learn what the aggregate device will be feeding us. Returns
  /// nil on failure so the caller can fall back to the 48 kHz F32
  /// stereo default.
  private func streamFormatForTap(tapID: AudioObjectID) -> AVAudioFormat? {
    var asbd = AudioStreamBasicDescription()
    var size = UInt32(MemoryLayout<AudioStreamBasicDescription>.size)
    var address = AudioObjectPropertyAddress(
      mSelector: kAudioTapPropertyFormat,
      mScope: kAudioObjectPropertyScopeGlobal,
      mElement: kAudioObjectPropertyElementMain
    )
    let status = AudioObjectGetPropertyData(
      tapID,
      &address,
      0,
      nil,
      &size,
      &asbd
    )
    guard status == noErr else { return nil }
    return AVAudioFormat(streamDescription: &asbd)
  }
}
