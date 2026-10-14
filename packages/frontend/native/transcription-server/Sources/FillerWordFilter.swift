import Foundation

/// Removes filler words and verbal disfluencies from transcribed
/// text. Optional — controlled per-meeting via the `removeFillers`
/// field on `TranscribeFileRequest`.
///
/// Two-phase approach:
///
/// 1. **Multi-word phrases first**: "you know,", "i mean,", "sort
///    of", "kind of". These need to come out as a unit; doing
///    single-word removal first would split them and leave broken
///    fragments behind.
///
/// 2. **Single fillers**: "uh", "um", "hmm", "mm", "er", etc. The
///    word "like" is intentionally NOT in the single-word list —
///    too many real uses ("I like coffee", "she said it's like new")
///    — only `"like,"` (with a trailing comma) is treated as filler,
///    since people writing "I, like, want to…" do put a comma in.
///    Same for `"you know,"`.
///
/// Post-cleanup:
///   - Collapse double-spaces left by removed fillers
///   - Re-capitalise the sentence start if removing a leading filler
///     dropped a lower-case letter into the first position
///
/// Why per-meeting toggle (not always on): some users (researchers,
/// transcribers, journalists) want verbatim output — fillers are
/// part of how someone speaks and removing them is a fidelity loss.
/// Default OFF; user opts in via Settings.
enum FillerWordFilter {
  // Single-word fillers, matched case-insensitively as whole tokens.
  // Comma-suffixed entries (`"uh,"`, `"like,"`) catch the same
  // filler when it ends a clause and the comma got included with
  // the token after splitting on spaces.
  private static let fillers: Set<String> = [
    "uh", "um", "uhh", "umm", "uh,", "um,", "uhh,", "umm,",
    "er", "err", "er,", "err,",
    "ah", "ahh", "ah,", "ahh,",
    "hmm", "hm", "mm", "mmm", "hmm,", "hm,", "mm,", "mmm,",
    "like,", // "like" only as filler when comma-suffixed
  ]

  // Multi-word filler phrases — replaced with empty string before
  // the single-word pass. Order matters: longer phrases first so
  // they consume their tokens before shorter ones do.
  private static let fillerPhrases: [String] = [
    "you know,",
    "i mean,",
    "sort of",
    "kind of",
  ]

  /// Strip filler words and phrases from `text`. Idempotent.
  /// Returns the original text unchanged when input is empty.
  static func apply(_ text: String) -> String {
    guard !text.isEmpty else { return text }

    var result = text

    // Phase 1: remove multi-word phrases (case-insensitive).
    // We loop-replace because a single phrase may appear multiple
    // times in one segment.
    for phrase in fillerPhrases {
      while let r = result.range(of: phrase, options: .caseInsensitive) {
        result.replaceSubrange(r, with: "")
      }
    }

    // Phase 2: remove single filler tokens.
    let words = result.components(separatedBy: " ")
    let kept = words.filter { word in
      !fillers.contains(word.lowercased())
    }
    result = kept.joined(separator: " ")

    // Cleanup: collapse multiple spaces, trim leading/trailing
    // whitespace introduced by the removals.
    while result.contains("  ") {
      result = result.replacingOccurrences(of: "  ", with: " ")
    }
    result = result.trimmingCharacters(in: .whitespaces)

    // Re-capitalise sentence start. Removing a leading "Um, " can
    // leave the next word lower-case ("um, the meeting" → "the
    // meeting"); fix the first character so output reads correctly.
    if let first = result.first, first.isLowercase {
      result = result.prefix(1).uppercased() + result.dropFirst()
    }

    return result
  }
}
