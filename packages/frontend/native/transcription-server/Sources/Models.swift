import Foundation

// MARK: - Shared types

enum MeetingState: String, Codable {
  case idle
  case recording
  case processing
}

struct TranscriptSegment: Codable {
  let start: String
  let end: String
  let text: String
  let quality: String? // "draft" | "final" — optional for back-compat with older saved meetings
  let speaker: String? // back-compat with older meetings. New transcriptions always set this to nil.
}

struct MeetingStatus: Codable {
  let state: String
  let duration: Double
  let segments: [TranscriptSegment]
  let error: String?
  /// Phase-7.5 follow-up: nil before any meeting has started, true
  /// during a `.recording` meeting where ScreenCaptureKit started
  /// successfully (live transcript has "Speaker" segments), false
  /// when Screen Recording permission is denied / no display is
  /// available. UI uses this to show an in-context banner with a
  /// "Open Settings" affordance during the meeting.
  let liveSystemAudioAvailable: Bool?
}

/// POST /meeting/start. Phase-7.6: now takes the output paths
/// for the canonical .m4a recording. Swift owns capture + disk
/// writing; the Rust audio recorder is no longer involved.
///
/// `audioPath` — required for the new path. nil/empty triggers
/// the legacy no-op behaviour (pre-7.6 callers passed an empty
/// body). The legacy path leaves Rust as the audio recorder and
/// just bumps server state to `.recording`. We keep this for one
/// release so Electron can migrate to the new contract without
/// a breaking jump.
/// `systemAudioPath` — optional, where the system .m4a goes.
/// nil means single-track (mic-only). Caller (Electron) is
/// responsible for ensuring the parent directories exist.
struct StartRequest: Codable {
  let audioPath: String?
  let systemAudioPath: String?
}

struct StartResponse: Codable {
  let success: Bool
  /// Echoes back the paths from the request so the caller has
  /// confirmation of where files will land. Same paths returned
  /// in StopResponse.
  let audioPath: String
  let systemAudioPath: String?
}

/// POST /meeting/stop. Phase-7.6: empty body. Swift already
/// knows where it's writing from `StartRequest`. (The previous
/// `audioPath` field on this request — used to tell the server
/// where Rust had written — is gone.)
struct StopRequest: Codable {}

/// Response for `/meeting/stop`. Phase-7.6: returns the recording
/// artifact paths (mic + optional system) so the caller can wire
/// them into the post-stop file pass without re-deriving from the
/// session ID. `segments` is always empty here — the actual
/// transcription happens later via `/meeting/transcribe-file`.
struct StopResponse: Codable {
  let success: Bool
  let title: String
  let segments: [TranscriptSegment]
  let audioPath: String
  let systemAudioPath: String?
}

/// Response for `/meeting/transcribe-file`. Carries the post-stop
/// transcript itself. Separate from `StopResponse` (Phase-7.6
/// rename) because the two endpoints now return different shapes:
/// stop returns paths, transcribe returns segments.
struct TranscribeFileResponse: Codable {
  let success: Bool
  let title: String
  let segments: [TranscriptSegment]
}

/// Body for POST /meeting/transcribe-file. Single-track or dual-
/// track depending on whether `systemAudioPath` is set:
///
/// - Single-track (no `systemAudioPath`): mic-only path. Cohere
///   transcribes `audioPath` once, returns a single segment
///   without a speaker label.
///
/// - Dual-track (`systemAudioPath` present): meeting was captured
///   in system-audio-on mode with separate mic and system streams.
///   Cohere transcribes each path independently; the mic segment
///   carries speaker="You", the system segment carries
///   speaker="Speaker". Results are merged by timestamp.
///
/// Blocks until the entire audio has been transcribed — no
/// truncation. With dual-track the wall-clock time is roughly the
/// sum of the two passes since the Cohere encoder serialises on
/// the ANE.
///
/// `diarise` is currently ignored — Cohere returns one segment per
/// file with nothing to attach speaker labels to. Kept on the
/// request shape for back-compat with older clients.
///
/// `removeFillers` (Phase-6) toggles `FillerWordFilter` on the
/// transcript. Default false — verbatim output preserves how the
/// speaker actually spoke. Opt in via Settings.
///
/// `customVocabulary` (Phase-6) is the user's personal word
/// dictionary. Each entry maps a misheard form to a preferred
/// spelling using Jaro-Winkler fuzzy match. Empty / nil = no-op.
///
/// `applyAec` (Phase-6.5) controls whether DTLN-aec runs as a
/// pre-transcribe pass on the mic stream of dual-track
/// recordings. Default true. Single-track recordings have no
/// reference signal so this flag is a no-op for them.
///
/// `engine` is ignored post-Phase-8d/e (Cohere is the only engine).
/// Kept on the request shape for back-compat — old clients that
/// pass `"whisper"` or `"cohere"` still work; the value is logged
/// but not used.
struct TranscribeFileRequest: Codable {
  let audioPath: String
  let systemAudioPath: String?
  let diarise: Bool?
  let removeFillers: Bool?
  let customVocabulary: [CustomWordEntry]?
  let applyAec: Bool?
  let engine: String?  // Ignored post-Phase-8d/e; back-compat only.
}

struct HealthResponse: Codable {
  let status: String
  /// Phase-8f: gate is now three models — Live (Parakeet-TDT for
  /// streaming drafts), AEC (DTLN echo cancellation for dual-track
  /// meetings), and Cohere (the only post-stop transcription
  /// engine). VAD and diariser were dropped — both were Whisper-era
  /// pre-passes and have been orphaned since Phase 8d/e; Cohere
  /// does its own framing internally.
  let modelsLoaded: Bool
  /// Live draft model. Phase-2: Whisper-tiny. Phase-7: Parakeet-TDT.
  let liveLoaded: Bool
  let liveProgress: Float
  /// DTLN-aec. Phase-6.5 addition. Bundled model — progress is
  /// effectively boolean (compile success / fail).
  let aecLoaded: Bool
  let aecProgress: Float
  /// Cohere Transcribe 2B. Phase-8 addition. Phase-8d/e: the only
  /// post-stop engine. Required field (no longer optional).
  let cohereLoaded: Bool
  let cohereProgress: Float
  let currentlyDownloading: String?
}

struct ErrorResponse: Codable {
  let error: String
}

// MARK: - Time formatting

func formatTime(_ seconds: Double) -> String {
  let total = Int(seconds)
  let h = total / 3600
  let m = (total % 3600) / 60
  let s = total % 60
  if h > 0 {
    return String(format: "%d:%02d:%02d", h, m, s)
  }
  return String(format: "%d:%02d", m, s)
}

/// Inverse of `formatTime` — parses a "mm:ss" or "h:mm:ss" string
/// back to a double of seconds. Used by MeetingCoordinator when
/// merging dual-track transcripts: mic and system segments share
/// the same time space (absolute meeting seconds), so a single
/// sort by start-second restores the chronological order. Returns
/// 0 on malformed input — defensive only, the formatter never
/// produces those strings.
func parseStartSeconds(_ formatted: String) -> Double {
  let parts = formatted.split(separator: ":")
  let nums = parts.compactMap { Int($0) }
  switch nums.count {
  case 2: return Double(nums[0] * 60 + nums[1])
  case 3: return Double(nums[0] * 3600 + nums[1] * 60 + nums[2])
  default: return 0
  }
}
