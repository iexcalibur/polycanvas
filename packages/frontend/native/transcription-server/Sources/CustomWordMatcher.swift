import Foundation

/// User-managed vocabulary post-processor. Replaces transcribed
/// words with the user's preferred spelling using fuzzy matching.
///
/// **Why post-process rather than prime Whisper's prompt:** prompt
/// priming biases the decoder but doesn't guarantee correct output;
/// fuzzy replace runs on the result so it's deterministic. Best
/// practice (per Muesli's reference implementation) is to do BOTH:
/// prime Whisper with the dictionary terms via the `prompt:` field
/// to give the model the right tokens, AND run this matcher on the
/// output to catch the cases where the model still got it wrong.
/// This file does the second half.
///
/// Matching stages (first match wins per word):
///   1. Exact case-insensitive match
///   2. Jaro-Winkler similarity ≥ the entry's configured threshold
///
/// Punctuation handling: trailing `.,!?;:` is stripped before
/// matching and re-attached to the replacement, so "BlockSuite." in
/// the source vocab list still matches "blocksuite," in the
/// transcript and emits "BlockSuite,".
///
/// Threshold guidance (per-entry, set by the user):
///   - 0.95+: very strict; only catches near-identical spellings
///     (typo-level differences). Good for short common words where
///     false positives would be costly.
///   - 0.85: typical default; catches "blocksuite" → "BlockSuite",
///     "polymind" → "PolyMind", "fluid odeo" → "FluidAudio".
///   - < 0.80: aggressive; risk false positives. Use for very
///     specific jargon you know nothing else sounds like.
struct CustomWordEntry: Codable {
  /// The misheard / approximate form the matcher looks for.
  let word: String
  /// What to substitute when a match is found.
  let replacement: String
  /// Per-entry similarity floor (0.0 … 1.0). Recommended: 0.85.
  let threshold: Double
}

enum CustomWordMatcher {
  /// Apply replacements to `text`. No-op when `entries` is empty.
  /// Returns the rewritten string.
  static func apply(_ text: String, entries: [CustomWordEntry]) -> String {
    guard !text.isEmpty, !entries.isEmpty else { return text }

    let words = text.components(separatedBy: " ")
    var result: [String] = []
    result.reserveCapacity(words.count)

    let punctuation = CharacterSet(charactersIn: ".,!?;:")

    for word in words {
      // Strip trailing punctuation so "blocksuite," matches the
      // dictionary entry "blocksuite". The trailing chars are
      // re-attached after replacement.
      let stripped = word.trimmingCharacters(in: punctuation)
      let trailing = String(word.dropFirst(stripped.count))
      let wordLower = stripped.lowercased()

      guard !wordLower.isEmpty else {
        result.append(word)
        continue
      }

      var bestMatch: String?
      var bestScore: Double = 0

      for entry in entries {
        let targetLower = entry.word.lowercased()

        // Stage 1: exact match short-circuits (perfect score).
        if wordLower == targetLower {
          bestMatch = entry.replacement
          break
        }

        // Stage 2: Jaro-Winkler. Per-entry threshold lets the user
        // dial sensitivity down for rare jargon and up for common
        // words where false positives would be embarrassing.
        let score = jaroWinklerSimilarity(wordLower, targetLower)
        if score >= entry.threshold && score > bestScore {
          bestScore = score
          bestMatch = entry.replacement
        }
      }

      if let match = bestMatch {
        result.append(match + trailing)
      } else {
        result.append(word)
      }
    }

    return result.joined(separator: " ")
  }

  // MARK: - Jaro-Winkler implementation

  /// Returns the Jaro-Winkler similarity of `s1` and `s2` in
  /// `[0.0, 1.0]`. Higher is more similar. Identical strings → 1.0;
  /// completely disjoint → 0.0.
  ///
  /// Jaro-Winkler is the standard fuzzy-string-match metric for
  /// short strings (names, jargon, single words). It's Jaro
  /// similarity with an extra prefix-bonus that boosts strings
  /// sharing a common start — useful for transcription where the
  /// front of a word is usually heard correctly and only the tail
  /// drifts ("BlockSuite" vs "blocksuit" share 8 chars of prefix
  /// → high JW score even though Jaro alone wouldn't be that high).
  static func jaroWinklerSimilarity(_ s1: String, _ s2: String) -> Double {
    let jaro = jaroSimilarity(s1, s2)
    guard jaro > 0 else { return 0 }

    let chars1 = Array(s1)
    let chars2 = Array(s2)
    let prefixLen = min(4, min(chars1.count, chars2.count))
    var commonPrefix = 0
    for i in 0..<prefixLen {
      if chars1[i] == chars2[i] {
        commonPrefix += 1
      } else {
        break
      }
    }

    // Standard Winkler prefix-bonus weight is 0.1.
    return jaro + Double(commonPrefix) * 0.1 * (1.0 - jaro)
  }

  private static func jaroSimilarity(_ s1: String, _ s2: String) -> Double {
    let chars1 = Array(s1)
    let chars2 = Array(s2)

    if chars1.isEmpty && chars2.isEmpty { return 1.0 }
    if chars1.isEmpty || chars2.isEmpty { return 0.0 }
    if chars1 == chars2 { return 1.0 }

    let matchWindow = max(chars1.count, chars2.count) / 2 - 1
    guard matchWindow >= 0 else { return 0.0 }

    var s1Matches = [Bool](repeating: false, count: chars1.count)
    var s2Matches = [Bool](repeating: false, count: chars2.count)

    var matches: Double = 0
    var transpositions: Double = 0

    // Find character matches inside the window.
    for i in 0..<chars1.count {
      let start = max(0, i - matchWindow)
      let end = min(chars2.count - 1, i + matchWindow)
      guard start <= end else { continue }

      for j in start...end {
        if s2Matches[j] || chars1[i] != chars2[j] { continue }
        s1Matches[i] = true
        s2Matches[j] = true
        matches += 1
        break
      }
    }

    guard matches > 0 else { return 0.0 }

    // Count transpositions (matched chars that are out of order).
    var k = 0
    for i in 0..<chars1.count {
      guard s1Matches[i] else { continue }
      while !s2Matches[k] { k += 1 }
      if chars1[i] != chars2[k] { transpositions += 1 }
      k += 1
    }

    let m = matches
    let t = transpositions / 2.0
    return (m / Double(chars1.count) + m / Double(chars2.count) + (m - t) / m) / 3.0
  }
}
