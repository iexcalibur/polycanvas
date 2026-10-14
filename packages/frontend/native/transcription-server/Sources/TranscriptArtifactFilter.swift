import Foundation

/// Removes Whisper-specific output artifacts that should never reach
/// the saved transcript. Sits between `sanitizeWhisperText` (token /
/// bracket cleanup) and the user-facing post-processing chain
/// (filler filter → custom vocab → turn normaliser).
///
/// Two artifact classes:
///
/// 1. **Blank-audio sentinels.** Whisper emits `[BLANK_AUDIO]` when
///    it identifies a chunk as silence. `sanitizeWhisperText` already
///    strips `[…]` annotations *inside* a longer string, but if the
///    entire segment IS the artifact (chunk was truly silent and
///    the model produced just the sentinel), the result after
///    bracket-stripping is empty whitespace which then trims to "".
///    We catch the case where the *only* output was the artifact and
///    explicitly return empty so downstream code can drop the segment.
///
/// 2. **Prompt regurgitation.** When we use Whisper's `prompt:`
///    parameter to bias the decoder toward proper nouns / names /
///    project terms, the model occasionally echoes the prompt
///    instructions back into the transcript text. Common patterns:
///      - "transcribe the spoken audio accurately"
///      - "if a word is unclear, use the most likely word that fits…"
///    The patterns are matched anchored at start OR end of the segment
///    (Whisper usually leaks the prompt as a leading or trailing
///    fragment, not in the middle) so we don't accidentally rewrite
///    ordinary speech that happens to contain similar wording.
///
/// All matching is case-insensitive. Whitespace is collapsed and
/// space-before-punctuation is fixed at the end of the pass.
enum TranscriptArtifactFilter {
  // Single-token artifacts. If the entire segment text equals one
  // of these (case-insensitive, post-trim), drop it.
  private static let fullTextArtifacts: Set<String> = [
    "[blank_audio]",
    "[silence]",
    "[no_speech]",
  ]

  // Anchored prompt-leakage patterns. These are the wordings we've
  // seen Whisper echo back when given a system-style prompt. Add
  // new patterns here if more variants surface in practice.
  // Keep them narrow — false positives would silently delete real
  // user speech that happens to use similar phrasing.
  private static let promptLeakPatterns: [String] = [
    #"(?i)\btranscribe the spoken audio accurately\.?"#,
    #"(?i)\bif a word is unclear,?\s*use the most likely word that fits well within the context of the overall sentence(?:\s+transcription)?\.?"#,
    #"(?i)\bplease transcribe the (?:audio|recording|meeting)\.?"#,
  ]

  /// Apply both filters. Returns the cleaned text, or empty string
  /// if the entire segment was an artifact (caller should drop it).
  static func apply(_ text: String) -> String {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    if fullTextArtifacts.contains(trimmed.lowercased()) {
      return ""
    }
    let stripped = stripPromptLeakage(from: trimmed)
    return stripped
  }

  private static func stripPromptLeakage(from text: String) -> String {
    guard !text.isEmpty else { return text }

    var result = text
    for pattern in promptLeakPatterns {
      // Anchor the leak at start of string (most common — Whisper
      // emits the prompt before the real transcript).
      let startAnchored = #"^\s*(?:"# + pattern + #")(?:\s+|$)"#
      result = result.replacingOccurrences(
        of: startAnchored,
        with: " ",
        options: .regularExpression
      )

      // Also anchor at end (sometimes the prompt trails after the
      // transcript when Whisper's decoder runs past the audio end).
      let endAnchored = #"(?:^|\s+)(?:"# + pattern + #")\s*$"#
      result = result.replacingOccurrences(
        of: endAnchored,
        with: " ",
        options: .regularExpression
      )
    }

    // Tidy up: collapse whitespace, remove space-before-punctuation
    // that the regex passes can introduce.
    result = result.replacingOccurrences(
      of: #"\s{2,}"#,
      with: " ",
      options: .regularExpression
    )
    result = result.replacingOccurrences(
      of: #"\s+([,.;:!?])"#,
      with: "$1",
      options: .regularExpression
    )
    return result.trimmingCharacters(in: .whitespacesAndNewlines)
  }
}
