import AVFoundation
import Foundation

/// Dual-track m4a writer for meeting recordings (Phase-7.6
/// replacement for the Rust audio capture path).
///
/// Mirrors what the Rust `media_capture` crate did: takes audio
/// buffers from both streams and writes AAC-compressed `.m4a`
/// files to disk. Lives alongside `LiveTranscriptionPipeline` —
/// `MeetingCoordinator` fans buffers from its captures into both,
/// so we capture once and consume the stream twice (live
/// processing + disk).
///
/// **AVAudioFile, not AVAssetWriter.** `AVAudioFile(forWriting:
/// settings:)` accepts AAC settings and handles compression
/// internally. We just write `AVAudioPCMBuffer`s as they arrive.
/// Simpler than `AVAssetWriter` (no presentation-time bookkeeping,
/// no `CMSampleBuffer` conversion) and produces files that
/// `AVAudioFile(forReading:)` — used by the post-stop Whisper
/// pass — opens identically to what Rust used to write.
///
/// **Format discovery is lazy.** AVAudioEngine's input format
/// depends on the live audio device (built-in mic vs AirPods vs
/// USB interface). SCStream's audio format depends on the system
/// mix configuration. Rather than ask either upfront, we open
/// each file on the first buffer for that stream — at that point
/// the format is concretely available via `buffer.format`.
///
/// **Thread safety.** Not `@MainActor` — buffer arrival cadence
/// (~10 ms) doesn't tolerate hops to the main actor. Instead:
///   - `paths` + `isRunning` are protected by a small `NSLock`.
///   - `micFile` is touched ONLY from `micWriteQueue` closures
///     (open / write / nil). Same for `systemFile` and
///     `systemWriteQueue`. No other thread reads or writes them
///     directly. Marking the class `@unchecked Sendable` is
///     correct because the actual concurrency is queue-confined.
///
/// **Failure semantics.** Any per-buffer write failure is logged
/// and skipped — keeps the recording rolling. `stop()` awaits
/// both queue drains so the last buffers land before the file is
/// closed.
final class MeetingRecordingWriter: @unchecked Sendable {
  // MARK: - Lock-protected state (mutated on start/stop, read on append)

  private let stateLock = NSLock()
  private var micPath: String?
  private var systemPath: String?
  private var isRunning = false

  // MARK: - Queue-confined state
  //
  // These are never touched outside their respective queue's
  // closures. Marking them `nonisolated(unsafe)` would be
  // appropriate but the class isn't actor-isolated to begin
  // with, so plain `var` is fine — the discipline is enforced
  // by where we read/write them, not by Swift's actor system.

  private var micFile: AVAudioFile?
  private var systemFile: AVAudioFile?

  // Per-stream resamplers. Lazy-initialised when the first buffer
  // arrives (we need the source format to build the converter). Kept
  // around for the rest of the meeting since the source format
  // doesn't change mid-recording. nil when source already matches
  // the target — no conversion needed, write straight through.
  private var micConverter: AVAudioConverter?
  private var micTargetFormat: AVAudioFormat?
  private var systemConverter: AVAudioConverter?
  private var systemTargetFormat: AVAudioFormat?

  private let micWriteQueue = DispatchQueue(
    label: "com.polymind.recording-writer.mic",
    qos: .utility
  )
  private let systemWriteQueue = DispatchQueue(
    label: "com.polymind.recording-writer.system",
    qos: .utility
  )

  /// Returned by `stop()`. Carries the canonical file paths the
  /// caller passed in. Mirrors the Rust `media_capture` artifact
  /// shape so downstream code (Electron's `RecordingCoordinator`)
  /// can consume it identically.
  struct RecordingArtifact {
    let micPath: String
    let systemPath: String?
  }

  // MARK: - Public API

  /// Start a new recording session. Records mic to `micPath` and
  /// (if non-nil) system to `systemPath`. Both paths' parent
  /// directories must exist; we don't create them.
  ///
  /// Doesn't actually open the files yet — see "Format discovery"
  /// in the type comment. Subsequent `appendMic` / `appendSystem`
  /// calls open the files on the first buffer per stream.
  func start(micPath: String, systemPath: String?) {
    stateLock.lock()
    defer { stateLock.unlock() }
    guard !isRunning else { return }
    self.micPath = micPath
    self.systemPath = systemPath
    isRunning = true
    NSLog(
      "[MeetingRecordingWriter] start (mic=%@, system=%@)",
      micPath,
      systemPath ?? "<none>"
    )
  }

  /// Append a mic buffer. Hops to `micWriteQueue` so the audio
  /// engine's tap queue isn't blocked on disk I/O. Drops the
  /// buffer silently if the writer wasn't started.
  func appendMic(_ buffer: AVAudioPCMBuffer) {
    let (running, path) = currentMicState()
    guard running, let path = path else { return }
    micWriteQueue.async { [weak self] in
      self?.writeMicBuffer(buffer, path: path)
    }
  }

  /// Append a system buffer. Same shape as `appendMic` but for
  /// the parallel stream.
  func appendSystem(_ buffer: AVAudioPCMBuffer) {
    let (running, path) = currentSystemState()
    guard running, let path = path else { return }
    systemWriteQueue.async { [weak self] in
      self?.writeSystemBuffer(buffer, path: path)
    }
  }

  /// Stop recording, drain in-flight writes, close both files.
  /// Returns the artifact paths so the coordinator can hand them
  /// to the post-stop pipeline.
  ///
  /// Awaits both write queues. The actual file close happens
  /// inside the final queued block (`micFile = nil` triggers
  /// AVAudioFile's deinit which finalises the m4a container).
  func stop() async -> RecordingArtifact? {
    stateLock.lock()
    let wasRunning = isRunning
    isRunning = false
    let mp = micPath
    let sp = systemPath
    stateLock.unlock()
    guard wasRunning else { return nil }

    // Chain queue async{} calls so the closes happen serially:
    // mic closes first, then system, then we resume the
    // continuation. This guarantees no in-flight write tries to
    // hit a nilled file.
    await withCheckedContinuation {
      (continuation: CheckedContinuation<Void, Never>) in
      micWriteQueue.async { [weak self] in
        self?.micFile = nil
        self?.systemWriteQueue.async {
          self?.systemFile = nil
          continuation.resume()
        }
      }
    }

    NSLog(
      "[MeetingRecordingWriter] stop (mic=%@, system=%@)",
      mp ?? "<none>",
      sp ?? "<none>"
    )
    guard let mp = mp else { return nil }
    return RecordingArtifact(micPath: mp, systemPath: sp)
  }

  // MARK: - Internals

  /// Snapshot lock-protected state for the mic append path.
  private func currentMicState() -> (Bool, String?) {
    stateLock.lock()
    defer { stateLock.unlock() }
    return (isRunning, micPath)
  }

  private func currentSystemState() -> (Bool, String?) {
    stateLock.lock()
    defer { stateLock.unlock() }
    return (isRunning, systemPath)
  }

  /// Open or reuse the mic file, write the buffer. Runs on
  /// `micWriteQueue` only.
  private func writeMicBuffer(_ buffer: AVAudioPCMBuffer, path: String) {
    if micFile == nil {
      let opened = openFileAndConverter(at: path, sourceFormat: buffer.format)
      micFile = opened.file
      micConverter = opened.converter
      micTargetFormat = opened.targetFormat
    }
    guard let file = micFile, let target = micTargetFormat else { return }
    let outBuffer = resample(
      buffer,
      converter: micConverter,
      targetFormat: target
    )
    guard let outBuffer = outBuffer else { return }
    do {
      try file.write(from: outBuffer)
    } catch {
      NSLog(
        "[MeetingRecordingWriter] mic write failed (%@): %@",
        path,
        error.localizedDescription
      )
    }
  }

  /// Open or reuse the system file, write the buffer. Runs on
  /// `systemWriteQueue` only.
  private func writeSystemBuffer(_ buffer: AVAudioPCMBuffer, path: String) {
    if systemFile == nil {
      let opened = openFileAndConverter(at: path, sourceFormat: buffer.format)
      systemFile = opened.file
      systemConverter = opened.converter
      systemTargetFormat = opened.targetFormat
    }
    guard let file = systemFile, let target = systemTargetFormat else { return }
    let outBuffer = resample(
      buffer,
      converter: systemConverter,
      targetFormat: target
    )
    guard let outBuffer = outBuffer else { return }
    do {
      try file.write(from: outBuffer)
    } catch {
      NSLog(
        "[MeetingRecordingWriter] system write failed (%@): %@",
        path,
        error.localizedDescription
      )
    }
  }

  /// Convert one input buffer to the target write format. Returns
  /// the input unchanged when no conversion is needed (source
  /// already matches target). Returns nil only on a converter
  /// error — caller drops the packet.
  private func resample(
    _ buffer: AVAudioPCMBuffer,
    converter: AVAudioConverter?,
    targetFormat: AVAudioFormat
  ) -> AVAudioPCMBuffer? {
    guard let converter = converter else {
      // No converter built → source matches target → pass through.
      return buffer
    }

    // Frame capacity scaled by sample-rate ratio so we don't
    // truncate when upsampling. Round up + small safety pad.
    let ratio = targetFormat.sampleRate / buffer.format.sampleRate
    let outCapacity = AVAudioFrameCount(
      Double(buffer.frameLength) * ratio + 16
    )
    guard
      let outBuffer = AVAudioPCMBuffer(
        pcmFormat: targetFormat,
        frameCapacity: outCapacity
      )
    else {
      return nil
    }

    var consumed = false
    let status = converter.convert(
      to: outBuffer,
      error: nil
    ) { _, outStatus in
      if consumed {
        outStatus.pointee = .noDataNow
        return nil
      }
      consumed = true
      outStatus.pointee = .haveData
      return buffer
    }

    if status == .error || outBuffer.frameLength == 0 {
      return nil
    }
    return outBuffer
  }

  /// Open a new AAC m4a file at the buffer's source format.
  /// Returns nil on failure (path inaccessible, encoder
  /// rejected the format, etc.) — caller drops the buffer and
  /// future buffers retry the open until it succeeds.
  ///
  /// Settings: AAC at the buffer's source sample rate / channel
  /// count, 64 kbps. The post-stop Whisper pass reads via
  /// `AVAudioFile(forReading:)` which decodes + resamples at
  /// load time, so the disk format doesn't have to match
  /// Whisper's 16 kHz mono input — recording at the device's
  /// native rate (typically 48 kHz) preserves quality if the
  /// user ever wants to re-listen or re-transcribe with a
  /// different model.
  /// Open the AAC m4a writer + (when needed) build an
  /// `AVAudioConverter` that resamples each incoming buffer to the
  /// file's target rate. Returns the file, the converter (nil when
  /// the source already matches the target — write pass-through),
  /// and the target format the file expects.
  ///
  /// Why we resample manually rather than rely on AVAudioFile's
  /// auto-conversion: `AVAudioFile.write(from:)` does NOT resample —
  /// it requires the buffer to match the file's processing format
  /// exactly. The `commonFormat` + `interleaved` parameters on the
  /// init only describe the *PCM layout* (Float32 vs Int16 etc.),
  /// not the sample rate. If we tell the file it's writing 48 kHz
  /// AAC and feed it 16 kHz buffers, the file mislabels the data
  /// and playback is ~3× too fast (Bluetooth-HFP mic regression).
  ///
  /// AAC output rate is pinned to 48 kHz when the source is below
  /// 22 kHz (low-rate AAC at 64 kbps mono is rejected by macOS's
  /// encoder with `kAudioFileInvalidFileError` ('!dat')). For
  /// higher-rate sources (built-in mic, USB interfaces) we keep
  /// the source rate as the output rate — no conversion needed,
  /// no conversion cost.
  private func openFileAndConverter(
    at path: String,
    sourceFormat: AVAudioFormat
  ) -> (file: AVAudioFile?, converter: AVAudioConverter?, targetFormat: AVAudioFormat?) {
    // Decide AAC output rate. Anything ≥ 22 kHz: keep as-is. Below
    // that: bump to 48 kHz so the encoder accepts it. (Bluetooth
    // SCO/HFP delivers 16 kHz; some legacy USB mics 22.05 kHz.)
    let needsResample = sourceFormat.sampleRate < 22_000
    let outputSampleRate: Double = needsResample ? 48_000 : sourceFormat.sampleRate

    guard
      let targetFormat = AVAudioFormat(
        commonFormat: .pcmFormatFloat32,
        sampleRate: outputSampleRate,
        channels: sourceFormat.channelCount,
        interleaved: false
      )
    else {
      NSLog(
        "[MeetingRecordingWriter] failed to build target format (%@, %.0f Hz, %d ch)",
        path,
        outputSampleRate,
        Int(sourceFormat.channelCount)
      )
      return (nil, nil, nil)
    }

    let settings: [String: Any] = [
      AVFormatIDKey: kAudioFormatMPEG4AAC,
      AVSampleRateKey: outputSampleRate,
      AVNumberOfChannelsKey: sourceFormat.channelCount,
      AVEncoderBitRateKey: 64_000,
    ]

    let file: AVAudioFile
    do {
      file = try AVAudioFile(
        forWriting: URL(fileURLWithPath: path),
        settings: settings,
        commonFormat: targetFormat.commonFormat,
        interleaved: targetFormat.isInterleaved
      )
    } catch {
      NSLog(
        "[MeetingRecordingWriter] open failed (%@, source %.0f Hz, target %.0f Hz, %d ch): %@",
        path,
        sourceFormat.sampleRate,
        outputSampleRate,
        Int(sourceFormat.channelCount),
        error.localizedDescription
      )
      return (nil, nil, nil)
    }

    let converter: AVAudioConverter? = needsResample
      ? AVAudioConverter(from: sourceFormat, to: targetFormat)
      : nil

    if needsResample && converter == nil {
      // Conversion needed but we couldn't build a converter — bail
      // so the caller doesn't write mismatched samples (the same
      // 3× speed-up we just diagnosed).
      NSLog(
        "[MeetingRecordingWriter] failed to build resampler (%@, %.0f → %.0f Hz)",
        path,
        sourceFormat.sampleRate,
        outputSampleRate
      )
      return (nil, nil, nil)
    }

    NSLog(
      "[MeetingRecordingWriter] opened %@ (input %.0f Hz → AAC %.0f Hz, %d ch%@)",
      path,
      sourceFormat.sampleRate,
      outputSampleRate,
      Int(sourceFormat.channelCount),
      needsResample ? " — resampling" : ""
    )
    return (file, converter, targetFormat)
  }
}
