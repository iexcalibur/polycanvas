import Foundation

/// Trigram + gap-aware merge of overlapping transcript pieces.
/// Ported from Muesli's `CohereTranscribeUtils.mergeOverlapping`.
///
/// **What problem this solves.** When two transcript fragments
/// share content at their boundary — either because two parallel
/// streams (mic + system) heard the same word, or because a
/// streaming model emits overlapping windows that re-transcribe
/// the same audio — naive concatenation leaves duplicates:
///
///     fragment A: "...we should ship the feature next week"
///     fragment B: "ship the feature next week then iterate"
///     concat:     "...we should ship the feature next week
///                  ship the feature next week then iterate"
///
/// Naive timestamp sorting doesn't help: both segments have valid
/// (but overlapping) timestamps. We need to recognise that the
/// front of B repeats the back of A and stitch them together:
///
///     merged:     "...we should ship the feature next week
///                  then iterate"
///
/// **How.** Build a hash index of word trigrams from the tail of
/// the previous fragment (last 40 words). Scan the head of the next
/// fragment (first 40 words) for any trigram that hits. The first
/// match marks an "anchor" — words after the anchor in B are new;
/// words before the anchor are duplicates of A's tail and get
/// dropped.
///
/// **Cost.** O(N) in the boundary windows (≤80 words combined per
/// merge). Trigram lookup is amortised O(1) via the hash. Way
/// cheaper than a full edit-distance pass.
///
/// **Fallback.** No trigram match → just concatenate with a space.
/// Better to ship the duplicate than guess wrong; the user can see
/// the redundancy and the diariser / cleanup chain will still
/// label segments correctly.
enum TranscriptOverlapMerge {
  /// Maximum words from each side considered for the trigram match.
  /// 40 is a generous upper bound on what a streaming model
  /// re-transcribes at a boundary; raising this just costs
  /// proportional CPU on each merge.
  private static let boundaryWindowWords = 40

  /// Merge a sequence of transcript fragments by deduplicating
  /// overlap at every boundary. The first fragment is taken as-is;
  /// subsequent fragments are appended with their leading overlap
  /// removed (or fully appended if no overlap is found).
  ///
  /// Empty inputs and single-element inputs short-circuit.
  static func merge(_ fragments: [String]) -> String {
    guard fragments.count > 1 else { return fragments.first ?? "" }

    var merged = fragments[0]
    for next in fragments.dropFirst() {
      merged = mergePair(prev: merged, next: next)
    }
    return merged
  }

  /// Merge two fragments. Returns `prev` unchanged when `next` is
  /// empty (and vice versa). When both have content but no trigram
  /// overlap is detectable, returns `prev + " " + next` —
  /// concatenation is safer than guessing.
  static func mergePair(prev: String, next: String) -> String {
    let trimmedNext = next.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmedNext.isEmpty { return prev }
    let trimmedPrev = prev.trimmingCharacters(in: .whitespacesAndNewlines)
    if trimmedPrev.isEmpty { return trimmedNext }

    let prevWords = trimmedPrev.split(separator: " ").map(String.init)
    let nextWords = trimmedNext.split(separator: " ").map(String.init)
    if prevWords.isEmpty { return trimmedNext }
    if nextWords.isEmpty { return trimmedPrev }

    // Normalise for comparison: lowercased, letters only. We keep
    // the original-cased / punctuated form for the output so
    // capitalisation and trailing punctuation survive the merge.
    let normalize: (String) -> String = { word in
      word.lowercased().filter(\.isLetter)
    }

    // Tail-of-prev trigram index: trigram → starting position in
    // the windowed tail (0-indexed). If the same trigram appears
    // multiple times we keep the FIRST occurrence — earliest match
    // produces the most aggressive dedup.
    let tailSize = min(prevWords.count, boundaryWindowWords)
    let tail = prevWords.suffix(tailSize).map(normalize)
    var trigramIndex: [String: Int] = [:]
    if tail.count >= 3 {
      for j in 0...(tail.count - 3) {
        let key = "\(tail[j])|\(tail[j + 1])|\(tail[j + 2])"
        if trigramIndex[key] == nil {
          trigramIndex[key] = j
        }
      }
    }

    // Scan the head of `next` for the first trigram that hits the
    // tail. When found, walk forward from that anchor in both
    // sides as long as words match — extends the overlap past the
    // initial 3-token anchor into the longest run we can find.
    let headSize = min(nextWords.count, boundaryWindowWords)
    let head = nextWords.prefix(headSize).map(normalize)
    var bestAnchorStart = -1
    var bestRunEnd = 0

    if head.count >= 3 {
      for j in 0...(head.count - 3) {
        let key = "\(head[j])|\(head[j + 1])|\(head[j + 2])"
        guard let tailPos = trigramIndex[key] else { continue }

        // Walk both sides forward to extend the run.
        var run = 3
        var ti = tailPos + 3
        var hi = j + 3
        while ti < tail.count, hi < head.count, tail[ti] == head[hi] {
          run += 1
          ti += 1
          hi += 1
        }

        // First hit wins (earliest dedup point in `next`).
        bestAnchorStart = j
        bestRunEnd = j + run
        break
      }
    }

    if bestAnchorStart >= 0 {
      // Words [0, bestAnchorStart) of `next` are NEW (not part of
      // the overlap). Words [bestAnchorStart, bestRunEnd) duplicate
      // the tail of `prev`. Words [bestRunEnd, ...) are new again.
      let preAnchor = nextWords.prefix(bestAnchorStart)
      let postOverlap = nextWords.dropFirst(bestRunEnd)
      let newWords = (Array(preAnchor) + Array(postOverlap))
      let newContent = newWords.joined(separator: " ")
      if newContent.isEmpty {
        return trimmedPrev
      }
      return trimmedPrev + " " + newContent
    }

    // No detectable overlap. Concatenate with a space — better to
    // emit the redundancy than fabricate a merge that loses
    // content.
    return trimmedPrev + " " + trimmedNext
  }
}
