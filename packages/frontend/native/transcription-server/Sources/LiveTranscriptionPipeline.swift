import AVFoundation
import FluidAudio
import Foundation

/// End-to-end live transcription pipeline.
///
/// **Phase-7 history.** Originally owned `LiveAudioCapture` +
/// `SystemAudioCapture` and drove them itself. Phase-7.6 moved
/// capture ownership up to `MeetingCoordinator` so a single set
/// of capture instances feeds **two** consumers: this pipeline
/// (live processing) and `MeetingRecordingWriter` (m4a disk
/// writes). The coordinator's onBuffer callbacks fan out to both.
///
/// **What this still does.** Owns two `SlidingWindowAsrManager`
/// actors (mic + system Parakeet streams), runs DTLN-AEC live
/// frame-by-frame on incoming mic samples (with system as the
/// far-end reference), and emits combined per-stream snapshots
/// via `onSegments`.
///
/// **API in / API out.**
///   - `feedMicBuffer(_:)` / `feedSystemBuffer(_:)` — coordinator
///     calls these as buffers arrive from its captures. Both are
///     `nonisolated` and dispatch their internal work via Tasks
///     — safe to call from arbitrary capture queues.
///   - `onSegments` — invoked with a full snapshot of the
///     current segment list whenever either stream produces an
///     update.
///
/// **Failure semantics.** AEC missing → mic passes through.
/// System Parakeet missing (init failure) → live transcript
/// becomes mic-only. Both Parakeet sessions failing →
/// `start()` throws and the coordinator skips live preview
/// entirely (recording-to-disk is unaffected).
///
/// One pipeline instance per meeting. `start` / `stop` are not
/// reusable — construct a fresh instance per meeting.
@MainActor
final class LiveTranscriptionPipeline {
  /// Caller-supplied. Invoked with the current full segment list
  /// (snapshot, not delta) on every update from either stream.
  /// Coordinator wires this to `inProgressSegments = ...`.
  var onSegments: (([TranscriptSegment]) -> Void)?

  // MARK: - Dependencies

  private let asrModels: AsrModels
  private let aecService: MeetingNeuralAec?
  private let applyAec: Bool

  // MARK: - Per-stream Parakeet

  private var micManager: SlidingWindowAsrManager?
  private var systemManager: SlidingWindowAsrManager?

  // MARK: - Workers (consume Parakeet's transcriptionUpdates)

  private var micWorker: Task<Void, Never>?
  private var systemWorker: Task<Void, Never>?

  /// True iff the system Parakeet session and the system stream
  /// itself are healthy. Coordinator queries this AFTER `start()`
  /// returns so it can surface the "system audio unavailable"
  /// banner if false. Set during `start()` based on whether the
  /// system manager init / load succeeded.
  private(set) var systemAudioActive: Bool = false

  // MARK: - Resampling

  /// Reused across all incoming buffers. FluidAudio's converter
  /// is stateless per `resampleBuffer` call (despite the type
  /// name). One instance is fine for both streams.
  private let audioConverter = AudioConverter()

  /// Pre-built target format for the 16 kHz mono Float32 buffers
  /// we hand to Parakeet's `streamAudio` after AEC. Built once
  /// at init since the format never changes.
  private let parakeetTargetFormat: AVAudioFormat? = AVAudioFormat(
    commonFormat: .pcmFormatFloat32,
    sampleRate: 16_000,
    channels: 1,
    interleaved: false
  )

  // MARK: - Per-stream segment state

  private var micConfirmed: [TranscriptSegment] = []
  private var micLastConfirmedLength = 0
  private var micVolatileTip: TranscriptSegment?

  private var systemConfirmed: [TranscriptSegment] = []
  private var systemLastConfirmedLength = 0
  private var systemVolatileTip: TranscriptSegment?

  /// Wall-clock start of the meeting. Stamps segments with
  /// elapsed time. Nil before start / after stop.
  private var startedAt: Date?

  private var isRunning = false

  init(
    asrModels: AsrModels,
    aecService: MeetingNeuralAec?,
    applyAec: Bool
  ) {
    self.asrModels = asrModels
    self.aecService = aecService
    self.applyAec = applyAec
  }

  // MARK: - Lifecycle

  /// Start both Parakeet streams + AEC streaming state.
  /// Coordinator must call this BEFORE wiring buffer callbacks
  /// (otherwise feed* could fire before Parakeet's input loop
  /// is ready).
  ///
  /// Throws only on mic Parakeet init failure (the catastrophic
  /// case). System Parakeet init failure is caught and the
  /// pipeline degrades to mic-only — `systemAudioActive` is set
  /// false; coordinator surfaces the banner.
  func start() async throws {
    guard !isRunning else { return }
    NSLog("[LiveTranscriptionPipeline] starting")

    if applyAec {
      aecService?.resetStreamingState()
    }

    // Mic Parakeet — required.
    let micManager = SlidingWindowAsrManager(config: .streaming)
    try await micManager.loadModels(asrModels)
    try await micManager.startStreaming(source: .microphone)
    self.micManager = micManager
    let micUpdates = await micManager.transcriptionUpdates
    micWorker = Task { [weak self] in
      for await update in micUpdates {
        guard let self = self else { return }
        await self.handleUpdate(update, stream: .mic, manager: micManager)
      }
    }

    // System Parakeet — optional.
    do {
      let systemManager = SlidingWindowAsrManager(config: .streaming)
      try await systemManager.loadModels(asrModels)
      try await systemManager.startStreaming(source: .microphone)
      self.systemManager = systemManager
      let systemUpdates = await systemManager.transcriptionUpdates
      systemWorker = Task { [weak self] in
        for await update in systemUpdates {
          guard let self = self else { return }
          await self.handleUpdate(
            update, stream: .system, manager: systemManager
          )
        }
      }
      systemAudioActive = true
    } catch {
      NSLog(
        "[LiveTranscriptionPipeline] system Parakeet init failed (mic-only live): %@",
        error.localizedDescription
      )
      systemAudioActive = false
    }

    self.startedAt = Date()
    isRunning = true
  }

  /// Coordinator calls this when the actual system capture (the
  /// SCStream the coordinator owns) failed to start. Flips
  /// `systemAudioActive` to false even if Parakeet init went
  /// fine — without buffers arriving, the system stream is dead
  /// in practice.
  func markSystemCaptureUnavailable() {
    systemAudioActive = false
    // Tear down the system Parakeet session so we don't sit
    // blocking on its worker forever waiting for samples that
    // won't come.
    if let mgr = systemManager {
      Task { [mgr] in
        await mgr.cancel()
        await mgr.cleanup()
      }
      systemManager = nil
      systemWorker?.cancel()
      systemWorker = nil
    }
  }

  /// Stop both Parakeet sessions, drain workers, reset state.
  /// Coordinator detaches buffer callbacks BEFORE calling this
  /// — otherwise `feed*` could fire after `manager.cleanup()`
  /// and crash on the released actor.
  func stop() async {
    guard isRunning else { return }
    NSLog("[LiveTranscriptionPipeline] stopping")

    // Drain any pending AEC frame so the last <512 mic samples
    // aren't lost. We don't push the result anywhere — Parakeet
    // is about to be told to finish. Live is best-effort; the
    // canonical transcript comes from the post-stop pass.
    if applyAec {
      _ = aecService?.flushStreamingMic()
    }

    if let mgr = micManager {
      _ = try? await mgr.finish()
      await mgr.cleanup()
    }
    if let mgr = systemManager {
      _ = try? await mgr.finish()
      await mgr.cleanup()
    }
    micManager = nil
    systemManager = nil

    await micWorker?.value
    await systemWorker?.value
    micWorker = nil
    systemWorker = nil

    micConfirmed.removeAll()
    systemConfirmed.removeAll()
    micLastConfirmedLength = 0
    systemLastConfirmedLength = 0
    micVolatileTip = nil
    systemVolatileTip = nil
    startedAt = nil
    isRunning = false
    systemAudioActive = false

    NSLog("[LiveTranscriptionPipeline] stopped")
  }

  // MARK: - Buffer feeds (called by MeetingCoordinator)

  /// Process one mic buffer: resample → AEC → re-pack → mic
  /// Parakeet. `nonisolated` so capture callbacks (any thread)
  /// can call without an `await`.
  nonisolated func feedMicBuffer(_ buffer: AVAudioPCMBuffer) {
    Task { @MainActor [weak self] in
      await self?.handleMicBuffer(buffer)
    }
  }

  /// Process one system buffer: resample → AEC reference +
  /// system Parakeet. `nonisolated` for the same reason as
  /// `feedMicBuffer`.
  nonisolated func feedSystemBuffer(_ buffer: AVAudioPCMBuffer) {
    Task { @MainActor [weak self] in
      await self?.handleSystemBuffer(buffer)
    }
  }

  // MARK: - Internal buffer handling (MainActor)

  private func handleMicBuffer(_ buffer: AVAudioPCMBuffer) async {
    guard let manager = micManager else { return }
    guard let micSamples = try? audioConverter.resampleBuffer(buffer) else {
      return
    }

    let cleaned: [Float]
    if applyAec, let aec = aecService, aec.isLoaded {
      cleaned = aec.processStreamingMic(micSamples)
    } else {
      cleaned = micSamples
    }
    guard !cleaned.isEmpty else { return }

    guard
      let format = parakeetTargetFormat,
      let pcm = AVAudioPCMBuffer(
        pcmFormat: format,
        frameCapacity: AVAudioFrameCount(cleaned.count)
      ),
      let channelData = pcm.floatChannelData
    else { return }

    pcm.frameLength = AVAudioFrameCount(cleaned.count)
    cleaned.withUnsafeBufferPointer { src in
      channelData[0].update(from: src.baseAddress!, count: cleaned.count)
    }

    await manager.streamAudio(pcm)
  }

  private func handleSystemBuffer(_ buffer: AVAudioPCMBuffer) async {
    guard let manager = systemManager else { return }
    guard let systemSamples = try? audioConverter.resampleBuffer(buffer) else {
      return
    }

    if applyAec, let aec = aecService, aec.isLoaded {
      aec.feedSystemSamples(systemSamples)
    }

    guard
      let format = parakeetTargetFormat,
      let pcm = AVAudioPCMBuffer(
        pcmFormat: format,
        frameCapacity: AVAudioFrameCount(systemSamples.count)
      ),
      let channelData = pcm.floatChannelData
    else { return }

    pcm.frameLength = AVAudioFrameCount(systemSamples.count)
    systemSamples.withUnsafeBufferPointer { src in
      channelData[0].update(from: src.baseAddress!, count: systemSamples.count)
    }

    await manager.streamAudio(pcm)
  }

  // MARK: - Update handling

  private enum Stream {
    case mic
    case system
  }

  private func handleUpdate(
    _ update: SlidingWindowTranscriptionUpdate,
    stream: Stream,
    manager: SlidingWindowAsrManager
  ) async {
    let confirmed = await manager.confirmedTranscript
    let volatileText = await manager.volatileTranscript

    switch stream {
    case .mic:
      updateMicState(confirmed: confirmed, volatileText: volatileText)
    case .system:
      updateSystemState(confirmed: confirmed, volatileText: volatileText)
    }

    onSegments?(buildSnapshot())
  }

  private func updateMicState(confirmed: String, volatileText: String) {
    if confirmed.count > micLastConfirmedLength {
      let startIdx = confirmed.index(
        confirmed.startIndex,
        offsetBy: micLastConfirmedLength
      )
      let delta = String(confirmed[startIdx...])
        .trimmingCharacters(in: .whitespacesAndNewlines)
      if !delta.isEmpty {
        micConfirmed.append(makeSegment(text: delta, speaker: "You"))
      }
      micLastConfirmedLength = confirmed.count
    }
    let trimmed = volatileText.trimmingCharacters(in: .whitespacesAndNewlines)
    micVolatileTip = trimmed.isEmpty
      ? nil
      : makeSegment(text: trimmed, speaker: "You")
  }

  private func updateSystemState(confirmed: String, volatileText: String) {
    if confirmed.count > systemLastConfirmedLength {
      let startIdx = confirmed.index(
        confirmed.startIndex,
        offsetBy: systemLastConfirmedLength
      )
      let delta = String(confirmed[startIdx...])
        .trimmingCharacters(in: .whitespacesAndNewlines)
      if !delta.isEmpty {
        systemConfirmed.append(makeSegment(text: delta, speaker: "Speaker"))
      }
      systemLastConfirmedLength = confirmed.count
    }
    let trimmed = volatileText.trimmingCharacters(in: .whitespacesAndNewlines)
    systemVolatileTip = trimmed.isEmpty
      ? nil
      : makeSegment(text: trimmed, speaker: "Speaker")
  }

  private func buildSnapshot() -> [TranscriptSegment] {
    var combined: [TranscriptSegment] = []
    combined.reserveCapacity(
      micConfirmed.count + systemConfirmed.count + 2
    )
    combined.append(contentsOf: micConfirmed)
    if let tip = micVolatileTip { combined.append(tip) }
    combined.append(contentsOf: systemConfirmed)
    if let tip = systemVolatileTip { combined.append(tip) }
    combined.sort { lhs, rhs in
      parseStartSeconds(lhs.start) < parseStartSeconds(rhs.start)
    }
    return combined
  }

  private func makeSegment(text: String, speaker: String) -> TranscriptSegment {
    let elapsed = startedAt.map { Date().timeIntervalSince($0) } ?? 0
    return TranscriptSegment(
      start: formatTime(elapsed),
      end: formatTime(elapsed),
      text: text,
      quality: "draft",
      speaker: speaker
    )
  }
}
