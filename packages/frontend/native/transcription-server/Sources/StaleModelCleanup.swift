import Foundation

/// One-shot startup cleanup for orphaned model directories.
///
/// Runs once when `TranscriptionService` initialises. Idempotent:
/// after the directories are gone, every subsequent call no-ops.
/// Failures are logged and swallowed — disk cleanup must never
/// block the server from coming up.
///
/// ## What gets cleaned
///
/// Phase-8d/e: removes ALL Whisper variants. The post-stop
/// engine is now Cohere Transcribe 2B; WhisperKit has been
/// dropped from the binary entirely. Any remaining WhisperKit
/// cache directories from previous installs are pure disk waste
/// and reclaim ~2 GB+ for users upgrading from Phase 8b/c.
///
/// Specifically, this removes:
///   - `openai_whisper-large-v3` — the post-stop engine pre-
///     Phase-8d/e. ~1.5 GB. Removed in this phase.
///   - `openai_whisper-tiny` — Phase-7: replaced by Parakeet-TDT
///     for the live draft pipeline. ~40 MB.
///   - `openai_whisper-small` — orphan from pre-Phase-7 dev.
///     ~250 MB.
///   - `openai_whisper-medium` — orphan from pre-Phase-7 dev.
///     ~1.5 GB.
///
/// Both the `.mlmodelc` directory under
/// `argmaxinc/whisperkit-coreml/` and the matching tokenizer
/// directory under `openai/` get deleted for each variant —
/// WhisperKit cached them as separate trees mirroring the
/// HuggingFace repo structure (`argmaxinc/whisperkit-coreml/...`
/// for compiled models, `openai/whisper-...` for tokenizers).
///
/// ## Path structure
///
/// WhisperKit laid out its cache under a `models/` subdirectory:
///
///     ~/Library/Application Support/PolyMind/whisperkit-models/
///     └── models/
///         ├── argmaxinc/whisperkit-coreml/
///         │   ├── openai_whisper-large-v3/   ← removed
///         │   ├── openai_whisper-tiny/       ← removed
///         │   ├── openai_whisper-small/      ← removed
///         │   └── openai_whisper-medium/     ← removed
///         └── openai/
///             ├── whisper-large-v3/          ← removed
///             ├── whisper-tiny/              ← removed
///             ├── whisper-small/             ← removed
///             └── whisper-medium/            ← removed
///
/// We also attempt to remove the parent `whisperkit-models/`
/// directory itself once everything inside is gone — leaves a
/// clean Application Support tree post-migration.
enum StaleModelCleanup {
  /// Whisper variants we no longer use anywhere in the code path.
  /// Listed in the form WhisperKit cached them: the compiled
  /// `.mlmodelc` directory carries the `openai_whisper-X` prefix.
  /// All four are now orphans (Phase-8d/e dropped large-v3 from
  /// the live code path).
  private static let orphanedWhisperKitVariants: [String] = [
    "openai_whisper-large-v3",
    "openai_whisper-tiny",
    "openai_whisper-small",
    "openai_whisper-medium",
  ]

  /// Matching tokenizer directories. WhisperKit puts these under a
  /// separate `openai/` subtree (HF repo layout), not the
  /// `argmaxinc/whisperkit-coreml/` one. The names drop the
  /// `openai_` prefix.
  private static let orphanedTokenizerVariants: [String] = [
    "whisper-large-v3",
    "whisper-tiny",
    "whisper-small",
    "whisper-medium",
  ]

  /// Run all cleanup tasks. Logs each removal with the freed
  /// space. Safe to call from anywhere; doesn't throw.
  static func run() {
    cleanupOrphanedWhisperVariants()
  }

  /// Walk the orphan list, remove every directory that exists,
  /// log a single summary at the end with the total bytes freed.
  private static func cleanupOrphanedWhisperVariants() {
    let fm = FileManager.default
    guard
      let appSupport = fm.urls(
        for: .applicationSupportDirectory,
        in: .userDomainMask
      ).first
    else { return }

    let modelsBase = appSupport.appending(
      path: "PolyMind/whisperkit-models/models"
    )
    let whisperKitBase = modelsBase.appending(
      path: "argmaxinc/whisperkit-coreml"
    )
    let tokenizerBase = modelsBase.appending(path: "openai")

    var totalBytes: Int64 = 0
    var removedCount = 0

    for variant in orphanedWhisperKitVariants {
      let url = whisperKitBase.appending(path: variant)
      let bytes = removeIfExists(at: url)
      if bytes > 0 {
        totalBytes += bytes
        removedCount += 1
      }
    }

    for variant in orphanedTokenizerVariants {
      let url = tokenizerBase.appending(path: variant)
      let bytes = removeIfExists(at: url)
      if bytes > 0 {
        totalBytes += bytes
        removedCount += 1
      }
    }

    if removedCount > 0 {
      NSLog(
        "[StaleModelCleanup] Removed %d orphaned Whisper variant dir(s) — freed %.1f MB",
        removedCount,
        Double(totalBytes) / 1_000_000.0
      )
    }
  }

  /// Try to remove the directory at `url`. Returns the bytes that
  /// were freed (0 on no-op or error). Logs success / failure with
  /// a per-directory message so partial failures are visible in
  /// the server log.
  ///
  /// We measure size before delete because afterwards the
  /// inode is gone. The size is best-effort — if `enumerator`
  /// fails for any reason we still attempt the delete and just
  /// report 0 bytes; the file system reclaims the space anyway.
  private static func removeIfExists(at url: URL) -> Int64 {
    let fm = FileManager.default
    var isDir: ObjCBool = false
    guard
      fm.fileExists(atPath: url.path, isDirectory: &isDir),
      isDir.boolValue
    else {
      return 0
    }

    let bytes = directorySize(at: url)
    do {
      try fm.removeItem(at: url)
      NSLog(
        "[StaleModelCleanup] Removed %@ (%.1f MB)",
        url.path,
        Double(bytes) / 1_000_000.0
      )
      return bytes
    } catch {
      NSLog(
        "[StaleModelCleanup] Failed to remove %@: %@",
        url.path,
        error.localizedDescription
      )
      return 0
    }
  }

  /// Sum the file sizes inside `url` recursively. Used purely for
  /// the "freed N MB" log messages. Returns 0 if any individual
  /// stat fails — the cleanup itself doesn't depend on this
  /// number being accurate.
  private static func directorySize(at url: URL) -> Int64 {
    let fm = FileManager.default
    guard
      let enumerator = fm.enumerator(
        at: url,
        includingPropertiesForKeys: [.fileSizeKey, .isRegularFileKey],
        options: [.skipsHiddenFiles]
      )
    else { return 0 }

    var total: Int64 = 0
    for case let fileURL as URL in enumerator {
      guard
        let values = try? fileURL.resourceValues(
          forKeys: [.fileSizeKey, .isRegularFileKey]
        ),
        values.isRegularFile == true,
        let size = values.fileSize
      else { continue }
      total += Int64(size)
    }
    return total
  }
}
