import Foundation

/// Thread-safe state holder for model download progress.
/// Not an actor — needs to be readable from any thread (including the HTTP
/// server queue) even while the main actor is blocked in CoreML compilation.
final class ModelDownloadState: @unchecked Sendable {
  struct Snapshot {
    /// Live draft model. Phase-2: Whisper-tiny (~40 MB). Phase-7:
    /// replaced by Parakeet-TDT (~250 MB). Streaming-native; produces
    /// hypothesis updates while the meeting is recording.
    var liveProgress: Float = 0
    var liveLoaded: Bool = false

    /// DTLN-aec (~40 MB, 2 CoreML parts). Removes echo of remote
    /// audio bleeding from the laptop speaker into the mic on
    /// dual-track recordings where the user isn't wearing
    /// headphones. Phase-6.5 addition. No granular progress —
    /// ships bundled, just a load-or-fail signal.
    var aecProgress: Float = 0
    var aecLoaded: Bool = false

    /// Cohere Transcribe 2B (~4 GB total: encoder ~3.5 GB +
    /// decoder prefill ~150 MB + decoder decode ~130 MB +
    /// tokenizer + mel filterbank). Phase-8d/e: now the only post-
    /// stop transcription engine — Whisper-large-v3 has been removed
    /// entirely. Hard-gated to macOS 15+ (MLState requirement);
    /// older OS can't run the binary.
    var cohereProgress: Float = 0
    var cohereLoaded: Bool = false

    var currentlyDownloading: String? = nil
  }

  private let lock = NSLock()
  private var data = Snapshot()

  func read() -> Snapshot {
    lock.lock()
    defer { lock.unlock() }
    return data
  }

  func update(_ mutation: (inout Snapshot) -> Void) {
    lock.lock()
    mutation(&data)
    lock.unlock()
  }
}
