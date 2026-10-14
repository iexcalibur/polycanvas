import AVFoundation
import Foundation

/// Mic-only audio capture for the live transcription pipeline.
///
/// Wraps `AVAudioEngine` with an input-node tap and forwards each
/// captured `AVAudioPCMBuffer` straight to a callback in whatever
/// format the system gives us (typically 48 kHz Float32 from a
/// MacBook built-in mic). The downstream consumer
/// (`LiveTranscriptionPipeline` → FluidAudio's Parakeet streaming
/// ASR) handles all format conversion internally — see
/// `SlidingWindowAsrManager.streamAudio(_:)` which says
/// "Audio buffer in any format (will be converted to 16 kHz mono)".
///
/// Phase-7 simplification: previously this file owned an
/// `AVAudioConverter` that resampled to 16 kHz mono Float32 for
/// Whisper-tiny. Whisper-tiny needed pre-converted samples; Parakeet
/// doesn't. Dropping our converter eliminates the per-buffer
/// memory allocation and sample-rate-conversion-on-the-audio-queue
/// overhead.
///
/// Why mic-only: the live pipeline is deliberately not capturing
/// system audio. The Rust recorder writes mic + system to a
/// dual-track .m4a in parallel via its own CoreAudio process tap;
/// that file is what feeds the post-stop large-v3 pass. Adding a
/// second `AudioHardwareCreateProcessTap` flow on the Swift side
/// just for live preview = high build cost for marginal value.
/// Granola does the same: live shows your voice, remote voices
/// appear after the meeting ends.
///
/// Threading: `AVAudioEngine` invokes the input tap on its own
/// dispatch queue. We forward the buffer on that same queue via
/// `onBuffer`. Caller's callback runs on the audio queue — keep
/// it cheap (the Parakeet manager's `streamAudio(_:)` is non-
/// blocking; it just yields to an internal AsyncStream).
final class LiveAudioCapture {
  /// Called for every captured input buffer in the engine's native
  /// format. Invoked on the audio engine's tap queue (not main).
  var onBuffer: ((AVAudioPCMBuffer) -> Void)?

  private let engine = AVAudioEngine()
  private var isRunning = false

  /// Tap buffer size. AVAudioEngine treats this as a hint; actual
  /// callback size depends on hardware. 4096 frames @ 48 kHz ≈ 85
  /// ms — small enough that Parakeet's hypothesis updates stay
  /// responsive (it emits hypothesis updates per ~1 s by default),
  /// large enough that we're not paying syscall overhead per buffer.
  private let tapBufferSize: AVAudioFrameCount = 4096

  // MARK: - Public API

  /// Start capturing. Throws if the input node has no hardware
  /// (rare — typically only on a Mac with no audio input devices)
  /// or the engine fails to start (permissions revoked at runtime).
  ///
  /// Idempotent — calling repeatedly while running is a no-op.
  func start() throws {
    if isRunning { return }

    let input = engine.inputNode
    let inFormat = input.inputFormat(forBus: 0)

    // Defensive: if the OS hands us a zero-rate / zero-channel
    // format (happens briefly during device hot-swap), bail.
    guard inFormat.sampleRate > 0, inFormat.channelCount > 0 else {
      throw NSError(
        domain: "LiveAudioCapture",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Input node has no valid format"]
      )
    }

    NSLog(
      "[LiveAudioCapture] input format: %.0f Hz, %d ch (forwarded raw — Parakeet handles conversion)",
      inFormat.sampleRate, Int(inFormat.channelCount)
    )

    input.installTap(
      onBus: 0,
      bufferSize: tapBufferSize,
      format: inFormat
    ) { [weak self] buffer, _ in
      // Forward the buffer as-is. Parakeet's streamAudio() does the
      // 16 kHz mono conversion internally via its own AudioConverter.
      self?.onBuffer?(buffer)
    }

    engine.prepare()
    try engine.start()
    isRunning = true
    NSLog("[LiveAudioCapture] engine started")
  }

  /// Stop capturing. Removes the tap and stops the engine. Safe to
  /// call repeatedly. Discards any in-flight data.
  func stop() {
    guard isRunning else { return }
    engine.inputNode.removeTap(onBus: 0)
    engine.stop()
    isRunning = false
    NSLog("[LiveAudioCapture] engine stopped")
  }
}
