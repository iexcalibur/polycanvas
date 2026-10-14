import DTLNAec512
import DTLNAecCoreML
import Foundation

/// Neural acoustic echo cancellation wrapper around DTLN-aec.
///
/// Used by `TranscriptionService` as a pre-Whisper pass on the
/// MIC stream of dual-track recordings. When the user records on
/// laptop speakers (rather than headphones) the remote
/// participant's voice — playing out of the speakers — bleeds
/// back into the mic. Without AEC, Whisper transcribes that voice
/// twice: once accurately from the system stream, once mangled
/// from the mic echo. The mic transcript ends up with garbled
/// duplicates of remote speech and the cleanup chain can't fix it
/// because the duplicates *are* speech.
///
/// DTLN-aec subtracts the system signal from the mic signal in
/// the frequency domain, leaving (close to) just the user's voice.
/// Runs as a 2-part CoreML model on the Apple Neural Engine —
/// ~3 ms per 512-sample (32 ms) frame on Apple Silicon, so a 30-min
/// meeting takes ~90 s of AEC time on top of decoding. Worth it.
///
/// Skipped when the meeting has no system stream (single-track
/// recordings) — there's nothing to cancel against. Caller is
/// responsible for not calling `process` in that case.
@MainActor
final class MeetingNeuralAec {
  /// Lazily initialised. Nil until `load()` succeeds.
  private var processor: DTLNAecEchoProcessor?

  var isLoaded: Bool { processor != nil }

  /// Frame size the model expects. The 512-unit (`.large`) variant
  /// processes 512 samples per call. Mismatched frame sizes
  /// produce wrong output silently.
  private static let frameSize = 512

  // MARK: - Streaming state (Phase-7.5)
  //
  // The streaming entrypoints below maintain rolling buffers so
  // mic + system samples can arrive on different schedules and
  // get paired by absolute sample position. The frame-by-frame
  // pattern matches Muesli's reference implementation.
  //
  // State is held in the actor (this @MainActor type) and only
  // touched from `feedSystemSamples`, `processStreamingMic`, and
  // `resetStreamingState`. Caller is responsible for serialising
  // these — typically driven from `LiveTranscriptionPipeline`'s
  // worker, which only invokes them in sequence per stream.

  /// Rolling buffer of system (far-end) samples — appended to as
  /// `feedSystemSamples` is called. Trimmed periodically as mic
  /// frames are processed past their position.
  private var streamingSystemBuffer: [Float] = []

  /// Total system samples ever fed in (absolute count). Used to
  /// know how much of the rolling buffer has arrived.
  private var streamingSystemSamplesReceived: Int = 0

  /// Total mic samples ever processed (absolute count). The next
  /// system frame to pair against starts at this position.
  private var streamingMicSamplesReceived: Int = 0

  /// Pending mic samples that haven't yet filled a 512-sample
  /// frame. Drained as more samples arrive.
  private var streamingMicFrameBuffer: [Float] = []

  /// Idempotent. Calling repeatedly is a no-op once loaded.
  /// Throws if CoreML compilation fails (rare — usually disk full
  /// or the package's resource bundle is missing from the build
  /// output).
  func load() async throws {
    if processor != nil { return }
    NSLog("[MeetingNeuralAec] Loading DTLN-aec 512-unit model")
    let start = Date()
    // 512-unit ("large") variant — best quality / latency tradeoff
    // for offline batch processing. The 128-unit variant is faster
    // but loses fidelity on quiet near-end speech.
    let proc = DTLNAecEchoProcessor(modelSize: .large)
    try await proc.loadModelsAsync(from: DTLNAec512.bundle)
    processor = proc
    NSLog(
      "[MeetingNeuralAec] DTLN-aec model loaded in %.2fs",
      Date().timeIntervalSince(start)
    )
  }

  /// Run a 1-second silent pass through the model so the CoreML
  /// kernels are JIT-compiled before the user's first real
  /// transcription. Same warmup pattern as Whisper / VAD.
  /// Errors are swallowed — warmup is best-effort.
  func warmup() async {
    guard let processor = processor else { return }
    NSLog("[MeetingNeuralAec] Warming up AEC")
    let silentFrame = [Float](repeating: 0, count: Self.frameSize)
    // Drive ~1 s of silent audio through to compile the kernels.
    // 16_000 / 512 ≈ 31 frames.
    processor.resetStates()
    for _ in 0..<32 {
      processor.feedFarEnd(silentFrame)
      _ = processor.processNearEnd(silentFrame)
    }
    processor.resetStates()
  }

  // MARK: - Streaming entrypoints (Phase-7.5)

  /// Reset streaming buffers + processor state for a new meeting.
  /// Call once at the start of each live session, before the first
  /// `feedSystemSamples` / `processStreamingMic` call. Idempotent.
  func resetStreamingState() {
    processor?.resetStates()
    streamingSystemBuffer.removeAll(keepingCapacity: true)
    streamingSystemSamplesReceived = 0
    streamingMicSamplesReceived = 0
    streamingMicFrameBuffer.removeAll(keepingCapacity: true)
  }

  /// Append far-end (system) samples to the rolling reference
  /// buffer. Call as system audio arrives — they're consumed
  /// position-by-position by `processStreamingMic` (mic sample at
  /// absolute index P pairs with system sample at index P).
  ///
  /// Samples beyond `streamingMicSamplesReceived` are kept buffered
  /// until mic catches up; samples below that index are trimmed
  /// periodically (see `processStreamingMic`) so memory stays
  /// bounded even on long meetings.
  func feedSystemSamples(_ samples: [Float]) {
    guard !samples.isEmpty else { return }
    streamingSystemBuffer.append(contentsOf: samples)
    streamingSystemSamplesReceived += samples.count
  }

  /// Process mic (near-end) samples through DTLN-aec, pairing each
  /// 512-sample frame with the system frame at the same absolute
  /// position. Returns the cleaned mic samples (same length as
  /// input minus any partial frame held back for the next call).
  ///
  /// **Position-paired alignment.** Mic frame at sample positions
  /// `[P, P+512)` is processed with system samples at `[P, P+512)`
  /// as the far-end reference. If system audio hasn't caught up
  /// (mic ahead of system), the missing far-end is zero-padded —
  /// effectively no echo to cancel, which is the right behaviour
  /// for that frame. Drift is impossible because both streams use
  /// absolute sample indices, not wall-clock time.
  ///
  /// **Memory.** System samples below `streamingMicSamplesReceived`
  /// are no longer needed (we won't pair against them again), so
  /// every ~16 000 samples (1 s) we trim the front of the rolling
  /// buffer to bound peak memory at ~64 KB regardless of meeting
  /// length.
  ///
  /// **Partial trailing frame.** If the input has fewer than 512
  /// remaining after the last full frame, those samples stay in
  /// `streamingMicFrameBuffer` and are returned on the next call.
  /// Caller's snapshot will be slightly behind real-time by up to
  /// 32 ms (one frame at 16 kHz). Acceptable for live transcript.
  ///
  /// **Passthrough fallback.** If the model failed to load,
  /// returns the input unchanged with a warning log. Caller should
  /// also have skipped calling us, but we defend in depth.
  func processStreamingMic(_ samples: [Float]) -> [Float] {
    guard let processor = processor else {
      NSLog(
        "[MeetingNeuralAec] streaming processor not loaded — passing through raw mic"
      )
      return samples
    }
    guard !samples.isEmpty else { return [] }

    streamingMicFrameBuffer.append(contentsOf: samples)
    var cleaned: [Float] = []
    cleaned.reserveCapacity(samples.count)

    let frameSize = Self.frameSize

    while streamingMicFrameBuffer.count >= frameSize {
      let micFrame = Array(streamingMicFrameBuffer.prefix(frameSize))
      streamingMicFrameBuffer.removeFirst(frameSize)

      // Pair against the system buffer at the absolute mic position.
      let systemPos = streamingMicSamplesReceived
      let systemFrame: [Float]
      if systemPos + frameSize <= streamingSystemSamplesReceived {
        // Whole far-end frame available.
        let bufStart = systemPos - (
          streamingSystemSamplesReceived - streamingSystemBuffer.count
        )
        systemFrame = Array(
          streamingSystemBuffer[bufStart..<(bufStart + frameSize)]
        )
      } else if systemPos < streamingSystemSamplesReceived {
        // Partial far-end frame — pad the tail with silence.
        let bufStart = systemPos - (
          streamingSystemSamplesReceived - streamingSystemBuffer.count
        )
        let available = streamingSystemSamplesReceived - systemPos
        systemFrame = Array(
          streamingSystemBuffer[bufStart..<streamingSystemBuffer.count]
        ) + [Float](repeating: 0, count: frameSize - available)
      } else {
        // System hasn't reached this position yet — zero-pad.
        // Mic effectively passes through this frame unchanged.
        systemFrame = [Float](repeating: 0, count: frameSize)
      }

      autoreleasepool {
        processor.feedFarEnd(systemFrame)
        let cleanedFrame = processor.processNearEnd(micFrame)
        cleaned.append(contentsOf: cleanedFrame)
      }

      streamingMicSamplesReceived += frameSize
    }

    // Trim consumed system samples once we've eaten ~1 s of audio.
    // Bounds peak memory at ~64 KB regardless of meeting length.
    let consumedFromBuffer = min(
      streamingMicSamplesReceived
        - (streamingSystemSamplesReceived - streamingSystemBuffer.count),
      streamingSystemBuffer.count
    )
    if consumedFromBuffer >= 16_000 {
      streamingSystemBuffer.removeFirst(consumedFromBuffer)
    }

    return cleaned
  }

  /// Drain any partial mic frame held back across calls. Call once
  /// at meeting end so the last <512 samples don't get lost.
  /// Zero-pads to a full frame, processes it, then returns only the
  /// real samples (trimmed back to the original tail length).
  func flushStreamingMic() -> [Float] {
    guard let processor = processor, !streamingMicFrameBuffer.isEmpty else {
      return []
    }
    let actualCount = streamingMicFrameBuffer.count
    let padded = streamingMicFrameBuffer
      + [Float](repeating: 0, count: Self.frameSize - actualCount)
    streamingMicFrameBuffer.removeAll(keepingCapacity: true)

    let systemFrame: [Float]
    let systemPos = streamingMicSamplesReceived
    if systemPos + Self.frameSize <= streamingSystemSamplesReceived {
      let bufStart = systemPos - (
        streamingSystemSamplesReceived - streamingSystemBuffer.count
      )
      systemFrame = Array(
        streamingSystemBuffer[bufStart..<(bufStart + Self.frameSize)]
      )
    } else {
      systemFrame = [Float](repeating: 0, count: Self.frameSize)
    }

    var result: [Float] = []
    autoreleasepool {
      processor.feedFarEnd(systemFrame)
      result = processor.processNearEnd(padded)
    }
    return Array(result.prefix(actualCount))
  }

  /// Run AEC on a complete mic recording using `reference` as the
  /// far-end (system) signal. Returns the cleaned mic samples,
  /// same length as input.
  ///
  /// Both arrays must be 16 kHz mono Float32. Mic and reference
  /// are paired by absolute sample position: mic sample at index P
  /// is processed against reference sample at index P. Reference
  /// can be shorter than mic (we zero-pad the tail) or longer (we
  /// truncate); samples that don't have a paired reference get
  /// silence as the far-end input which means no echo to cancel —
  /// the mic passes through close to unchanged.
  ///
  /// Stateful — the model tracks LSTM state across frames within
  /// a call but not between calls. Each `process` invocation
  /// resets state so previous meetings don't bleed into the
  /// current one.
  func process(mic: [Float], reference: [Float]) -> [Float] {
    guard let processor = processor else {
      NSLog("[MeetingNeuralAec] processor not loaded — passing through raw mic")
      return mic
    }

    NSLog(
      "[MeetingNeuralAec] processing %d mic samples (%.1fs) against %d reference samples (%.1fs)",
      mic.count, Double(mic.count) / 16_000.0,
      reference.count, Double(reference.count) / 16_000.0
    )
    let start = Date()
    processor.resetStates()

    var cleaned: [Float] = []
    cleaned.reserveCapacity(mic.count)

    let frameSize = Self.frameSize
    var pos = 0

    while pos + frameSize <= mic.count {
      let micFrame = Array(mic[pos..<(pos + frameSize)])
      let refFrame: [Float]
      if pos + frameSize <= reference.count {
        refFrame = Array(reference[pos..<(pos + frameSize)])
      } else if pos < reference.count {
        // Partial reference at the tail — pad with silence.
        let available = reference.count - pos
        refFrame = Array(reference[pos..<reference.count])
          + [Float](repeating: 0, count: frameSize - available)
      } else {
        // No reference — mic passes through (silence as far-end
        // means nothing for the model to subtract).
        refFrame = [Float](repeating: 0, count: frameSize)
      }

      autoreleasepool {
        processor.feedFarEnd(refFrame)
        let out = processor.processNearEnd(micFrame)
        cleaned.append(contentsOf: out)
      }
      pos += frameSize
    }

    // Tail — partial frame at the end. Zero-pad to frame size,
    // process, and trim back to the actual remaining count so we
    // return exactly `mic.count` samples.
    if pos < mic.count {
      let remaining = mic.count - pos
      let micTail = Array(mic[pos..<mic.count])
        + [Float](repeating: 0, count: frameSize - remaining)
      let refTail: [Float]
      if pos + frameSize <= reference.count {
        refTail = Array(reference[pos..<(pos + frameSize)])
      } else if pos < reference.count {
        let available = reference.count - pos
        refTail = Array(reference[pos..<reference.count])
          + [Float](repeating: 0, count: frameSize - available)
      } else {
        refTail = [Float](repeating: 0, count: frameSize)
      }
      autoreleasepool {
        processor.feedFarEnd(refTail)
        let out = processor.processNearEnd(micTail)
        cleaned.append(contentsOf: Array(out.prefix(remaining)))
      }
    }

    let elapsed = Date().timeIntervalSince(start)
    NSLog(
      "[MeetingNeuralAec] AEC pass done in %.1fs (%.2fx realtime)",
      elapsed,
      Double(mic.count) / 16_000.0 / max(elapsed, 0.001)
    )
    return cleaned
  }
}
