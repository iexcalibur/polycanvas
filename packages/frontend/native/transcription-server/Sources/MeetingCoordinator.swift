import AVFoundation
import Foundation

/// Orchestrates meeting state tracking + live draft transcription
/// + canonical .m4a recording (Phase-7.6: Swift owns the whole
/// audio path, Rust recorder retired).
///
/// **Capture model.** The coordinator owns one `LiveAudioCapture`
/// (mic, AVAudioEngine) and one `SystemAudioCapture`
/// (ScreenCaptureKit). Each `onBuffer` callback fans out to two
/// consumers:
///   1. `LiveTranscriptionPipeline` — Parakeet streaming + DTLN-AEC
///      + per-track segment emission. Live preview text in the UI.
///   2. `MeetingRecordingWriter` — AVAudioFile/AAC writes to disk.
///      Canonical .m4a files used by the post-stop Whisper-large-v3
///      pass and surfaced to history.
/// One capture, two consumers — no duplicate macOS audio taps.
///
/// State machine:
/// - `.idle`       — no meeting, no transcription in flight
/// - `.recording`  — captures running; pipeline + writer both
///                   consuming. Live drafts populate
///                   `inProgressSegments`.
/// - `.processing` — user clicked Transcribe; Whisper-large-v3 is
///                   running on the saved .m4a. Drafts cleared;
///                   final segments stream into the same list.
///                   Start Meeting is blocked client-side while
///                   this is true.
@MainActor
class MeetingCoordinator {
  let transcriptionService = TranscriptionService()

  private(set) var state: MeetingState = .idle
  private(set) var meetingStartTime: Date?
  private(set) var lastError: String?

  // MARK: - Capture (Phase-7.6 — owned here, not in pipeline)

  private let micCapture = LiveAudioCapture()
  private let systemCapture = SystemAudioCapture()

  // MARK: - Consumers

  /// The active live pipeline. Constructed in `startMeeting`, torn
  /// down in `stopMeeting` / `cancelMeeting`. Nil at all other
  /// times. Nil during `.recording` means live preview failed to
  /// start — the meeting still records to disk via the writer
  /// below; the UI just doesn't show drafts.
  private var livePipeline: LiveTranscriptionPipeline?

  /// The active recording writer. Holds two AVAudioFile/AAC
  /// outputs (mic + system). Constructed at meeting start with
  /// caller-provided paths, finalised at stop, returns the same
  /// paths back as the recording artifact.
  private let recordingWriter = MeetingRecordingWriter()

  /// Output paths for the current recording. Captured at
  /// `startMeeting`, returned via `stopMeeting`. Nil between
  /// meetings.
  private var currentMicPath: String?
  private var currentSystemPath: String?

  /// Snapshot of `livePipeline?.systemAudioActive` cached at start
  /// time. Nil between meetings; true/false during `.recording` and
  /// briefly after stop. Surfaced via `MeetingStatus.liveSystemAudioAvailable`
  /// so the UI can render a permission-fix banner when the live
  /// system stream isn't running (most often: user denied Screen
  /// Recording in System Settings, or hasn't been prompted yet).
  ///
  /// We snapshot rather than read through to the pipeline because
  /// the pipeline's internal state is `@MainActor`-isolated and
  /// the HTTP server reads status from any queue — plus we want
  /// the value to survive briefly after `stopMeeting` so a final
  /// status poll reflects what was happening during the meeting.
  private var liveSystemAudioAvailable: Bool?

  /// Segments produced by either the live pipeline (during
  /// `.recording`) or the file pass (during `.processing`). Quality
  /// field distinguishes: `"draft"` = live, `"final"` = file pass.
  ///
  /// Cleared at:
  ///   - `startMeeting` start (drop drafts from the prior meeting)
  ///   - `transcribeFile` start (drop drafts; final pass replaces them)
  ///
  /// Returned by `getStatus` while `.recording` or `.processing` so
  /// the React UI can poll for streaming output.
  private var inProgressSegments: [TranscriptSegment] = []

  var duration: Double {
    guard let start = meetingStartTime else { return 0 }
    return Date().timeIntervalSince(start)
  }

  /// Direct reference to the download state so callers (HTTP server) can
  /// read it without needing MainActor, even while CoreML compilation is
  /// blocking the main thread.
  nonisolated let modelState: ModelDownloadState

  /// Read-through helpers for HTTP layer
  var isLiveModelLoaded: Bool { modelState.read().liveLoaded }
  var isAecModelLoaded: Bool { modelState.read().aecLoaded }
  var isCohereModelLoaded: Bool { modelState.read().cohereLoaded }

  init() {
    self.modelState = transcriptionService.downloadState
  }

  // MARK: - Lifecycle

  /// Load all three models in sequence. Phase-8f: VAD + diariser
  /// are gone (both were Whisper-era pre-passes; Cohere does its
  /// own framing and produces a single segment with nothing for
  /// diarisation to attach to). Sequential so the user sees a
  /// single progress bar walk from 0 → 100 % per model rather
  /// than concurrent downloads fighting for bandwidth.
  ///
  /// Order:
  ///   1. Live (Parakeet-TDT; ~250 MB; seconds — ungates recording
  ///      with draft transcripts)
  ///   2. AEC (DTLN-aec ~40 MB; bundled, ~1 s compile — ungates
  ///      echo cancellation for dual-track recordings)
  ///   3. Cohere Transcribe 2B (~4 GB; minutes — the post-stop
  ///      transcription engine. Non-throwing: a load failure leaves
  ///      `transcribeEntireFile` returning empty with a clear log.)
  ///
  /// AEC runs second because it's bundled (no download) and the
  /// user can already start a meeting once Live is up; if AEC
  /// hasn't finished when they hit Transcribe, the mic pass
  /// degrades to passthrough (no echo cancellation) rather than
  /// blocking.
  func loadModels() async throws {
    try await transcriptionService.loadLiveModel()
    try await transcriptionService.loadAecModel()
    // Cohere is the post-stop engine (Phase-8d/e: Whisper-large-v3
    // removed entirely). Non-throwing — on failure the next
    // /meeting/transcribe-file call returns empty with a clear log
    // line so the UI can surface "transcription unavailable".
    await transcriptionService.loadCohereModel()
  }

  /// Phase-7.6 transitional entrypoint for legacy clients (pre-
  /// path-aware Electron). Sets up the same Swift captures + live
  /// pipeline as the new path-aware `startMeeting(audioPath:
  /// systemAudioPath:)` but skips the disk writer — Rust is still
  /// the canonical .m4a recorder for these clients. Once Electron
  /// migrates to passing paths, this and the Rust audio capture
  /// can both be retired.
  func startMeetingLegacyNoCapture() async throws {
    try await startMeetingInternal(
      audioPath: nil,
      systemAudioPath: nil
    )
    NSLog(
      "[MeetingCoordinator] Meeting started (legacy: Swift captures + live pipeline running, Rust still writing canonical m4a)"
    )
  }

  /// Phase-7.6: now takes output paths. Coordinator owns the
  /// captures and writes m4a files in Swift; Rust recorder is no
  /// longer involved in audio capture.
  ///
  /// `audioPath` — required, where the mic .m4a goes.
  /// `systemAudioPath` — optional, where the system .m4a goes.
  /// nil means single-track (mic-only recording).
  ///
  /// On success: captures running, writer recording, live pipeline
  /// (if models loaded) consuming the same buffers in parallel.
  /// On failure of any individual piece: see comments below for
  /// the per-failure degradation path.
  func startMeeting(
    audioPath: String,
    systemAudioPath: String?
  ) async throws {
    try await startMeetingInternal(
      audioPath: audioPath,
      systemAudioPath: systemAudioPath
    )
  }

  /// Common machinery for both the legacy (`audioPath == nil`)
  /// and Phase-7.6 (`audioPath != nil`) start paths. The only
  /// behavioural difference: legacy skips `recordingWriter.start`
  /// since Rust still owns disk writing for those callers.
  private func startMeetingInternal(
    audioPath: String?,
    systemAudioPath: String?
  ) async throws {
    guard state == .idle else {
      throw NSError(
        domain: "MeetingCoordinator",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "Meeting already in progress"]
      )
    }

    // Model preload so the user doesn't wait the full CoreML
    // compile time when they first click Transcribe. Safe to
    // call repeatedly.
    if !transcriptionService.isLiveModelLoaded {
      try await transcriptionService.loadLiveModel()
    }

    // Fresh slate: drop any drafts left over from a prior meeting.
    inProgressSegments = []
    lastError = nil
    meetingStartTime = Date()
    currentMicPath = audioPath
    currentSystemPath = systemAudioPath

    // 1. Build the live pipeline (if Parakeet models loaded).
    //    Phase-7.6: pipeline no longer owns captures. We feed
    //    buffers into it from the coordinator's capture handlers.
    var pipeline: LiveTranscriptionPipeline?
    if let asrModels = transcriptionService.liveModels {
      let p = LiveTranscriptionPipeline(
        asrModels: asrModels,
        aecService: transcriptionService.aec,
        applyAec: true
      )
      // onSegments is a SNAPSHOT of the full per-stream live
      // transcript. Replace, don't append.
      p.onSegments = { [weak self] segments in
        self?.inProgressSegments = segments
      }
      do {
        try await p.start()
        pipeline = p
        liveSystemAudioAvailable = p.systemAudioActive
      } catch {
        NSLog(
          "[MeetingCoordinator] Live pipeline start failed (non-fatal, recording continues): %@",
          error.localizedDescription
        )
        pipeline = nil
        // Live preview unavailable, but we still record + the
        // post-stop pass still runs. Leave flag false so the
        // banner surfaces consistently.
        liveSystemAudioAvailable = false
      }
    } else {
      NSLog(
        "[MeetingCoordinator] Skipping live pipeline — Parakeet models not loaded"
      )
      // Models didn't load → no live preview. Banner would be
      // misleading (Screen Recording isn't the issue) so flag stays
      // nil; UI shows nothing extra.
      liveSystemAudioAvailable = nil
    }
    livePipeline = pipeline

    // 2. Start the disk writer ONLY when caller passed paths
    //    (Phase-7.6). Legacy callers (`audioPath == nil`) leave
    //    Rust as the canonical writer; Swift just runs captures
    //    + pipeline and skips disk I/O entirely.
    if let micPath = audioPath {
      recordingWriter.start(
        micPath: micPath,
        systemPath: systemAudioPath
      )
    }

    // 3. Wire mic capture (AVAudioEngine on the user's selected
    //    input device — typically AirPods). This is the SOURCE
    //    of the user's voice for both `mic.m4a` and the live
    //    Parakeet "You" stream. Runs entirely independently of
    //    SystemAudioCapture (different CoreAudio device, no
    //    contention).
    let writeMic = audioPath != nil
    let writeSystem = systemAudioPath != nil
    micCapture.onBuffer = { [weak self] buffer in
      guard let self = self else { return }
      if writeMic {
        self.recordingWriter.appendMic(buffer)
      }
      self.livePipeline?.feedMicBuffer(buffer)
    }

    // 4. Wire system capture's tap-only output. SystemAudioCapture
    //    builds an aggregate device clocked from the BUILT-IN mic
    //    (always 48 kHz, never in HFP mode); the tap is the only
    //    payload we forward downstream. The built-in mic's samples
    //    are discarded inside `handleInputBuffer` — they're just
    //    there to keep the aggregate's clock ticking at a sample
    //    rate that matches the tap. Avoiding the user's selected
    //    input as the aggregate's clock is what fixes the AirPods
    //    16 kHz / tap 48 kHz mismatch that was killing the IO loop.
    systemCapture.onSystemBuffer = { [weak self] buffer in
      guard let self = self else { return }
      if writeSystem {
        self.recordingWriter.appendSystem(buffer)
      }
      self.livePipeline?.feedSystemBuffer(buffer)
    }

    // 5. Start mic capture (required). Throws if the input device
    //    has no hardware. Tear down everything started so far
    //    before propagating.
    do {
      try micCapture.start()
    } catch {
      NSLog(
        "[MeetingCoordinator] Mic capture failed to start: %@",
        error.localizedDescription
      )
      micCapture.onBuffer = nil
      systemCapture.onSystemBuffer = nil
      _ = await recordingWriter.stop()
      if let pipeline = livePipeline {
        await pipeline.stop()
      }
      livePipeline = nil
      currentMicPath = nil
      currentSystemPath = nil
      throw error
    }

    // 6. Start system capture. Failure is non-fatal: the meeting
    //    keeps recording mic-only and the UI surfaces a permission
    //    banner via `liveSystemAudioAvailable=false`.
    if livePipeline != nil || systemAudioPath != nil {
      do {
        try await systemCapture.start()
      } catch {
        NSLog(
          "[MeetingCoordinator] System capture failed (mic-only live%@): %@",
          systemAudioPath == nil ? "" : " + writer",
          error.localizedDescription
        )
        systemCapture.onSystemBuffer = nil
        livePipeline?.markSystemCaptureUnavailable()
        liveSystemAudioAvailable = false
      }
    }

    NSLog(
      "[MeetingCoordinator] Meeting started — pipeline=%@, writer=mic+%@, systemAudioActive=%@",
      pipeline == nil ? "off" : "on",
      systemAudioPath == nil ? "(none)" : "system",
      String(describing: liveSystemAudioAvailable ?? false)
    )
    state = .recording
  }

  /// Stop the live pipeline and flip state to `.idle`. The Rust
  /// recorder has already finalized the .m4a file independently;
  /// this is just our side of the meeting end.
  ///
  /// Note: we keep `inProgressSegments` populated with the live
  /// drafts so the UI keeps showing them in the brief window
  /// between stop and the user clicking Transcribe (or auto-
  /// transcribe firing). `transcribeFile` clears them when the
  /// final pass starts — that's the natural replace point.
  /// Phase-7.6: stop both captures, finalise the writer, tear
  /// down the live pipeline. Returns the recorded artifact paths
  /// (mic + optional system) so the caller can wire them into
  /// the post-stop file pass.
  ///
  /// Order matters:
  ///   1. Detach buffer callbacks (no more buffers fan out)
  ///   2. Stop captures (no more buffers arrive at all)
  ///   3. Stop the writer (drains write queues, closes files —
  ///      finalises m4a containers)
  ///   4. Stop the pipeline (drains Parakeet workers — must come
  ///      AFTER captures so feed* doesn't get called on a dead
  ///      manager actor)
  func stopMeeting() async throws -> StopResponse {
    guard state == .recording else {
      throw NSError(
        domain: "MeetingCoordinator",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "No meeting in progress"]
      )
    }

    // 1. Detach callbacks first.
    micCapture.onBuffer = nil
    systemCapture.onSystemBuffer = nil

    // 2. Stop captures.
    micCapture.stop()
    await systemCapture.stop()

    // 3. Finalise writer + collect artifact paths.
    let artifact = await recordingWriter.stop()

    // 4. Stop pipeline (after captures so its feed* methods
    //    can't race against a dead manager).
    if let pipeline = livePipeline {
      await pipeline.stop()
      livePipeline = nil
    }

    // We deliberately keep `liveSystemAudioAvailable` as-is here
    // (don't reset to nil). A status poll between stop and the
    // next meeting will still reflect whether the live system
    // stream was working, which is the correct historical
    // answer. Reset at the next `startMeeting`.

    let micPath = artifact?.micPath ?? currentMicPath ?? ""
    let systemPath = artifact?.systemPath ?? currentSystemPath
    currentMicPath = nil
    currentSystemPath = nil

    state = .idle
    NSLog(
      "[MeetingCoordinator] Meeting ended — wrote mic=%@ system=%@",
      micPath,
      systemPath ?? "<none>"
    )
    return StopResponse(
      success: true,
      title: "Meeting Transcript",
      segments: [],
      audioPath: micPath,
      systemAudioPath: systemPath
    )
  }

  func cancelMeeting() async {
    micCapture.onBuffer = nil
    systemCapture.onSystemBuffer = nil
    micCapture.stop()
    await systemCapture.stop()
    _ = await recordingWriter.stop()
    if let pipeline = livePipeline {
      await pipeline.stop()
      livePipeline = nil
    }
    inProgressSegments = []
    lastError = nil
    meetingStartTime = nil
    liveSystemAudioAvailable = nil
    currentMicPath = nil
    currentSystemPath = nil
    state = .idle
    NSLog("[MeetingCoordinator] Meeting cancelled")
  }

  /// User-triggered full-file transcription. Single-track if only
  /// `audioPath` is supplied (mic-only mode); dual-track if
  /// `systemAudioPath` is also supplied (system audio toggle was
  /// on, separate streams were recorded).
  ///
  /// Both modes run Whisper in 60s chunks and append segments to
  /// `inProgressSegments` as they complete so React can poll
  /// /meeting/status for streaming UI. Dual-track mode runs the
  /// two passes sequentially (mic first, system second) — Whisper
  /// serialises on the ANE anyway, so concurrent transcription
  /// wouldn't actually parallelise. Mic segments carry
  /// `speaker = "You"`; system segments carry `speaker = "Speaker"`.
  /// Final list is merged by timestamp before return.
  func transcribeFile(
    audioPath: String,
    systemAudioPath: String? = nil,
    diarise: Bool = true,
    removeFillers: Bool = false,
    customVocabulary: [CustomWordEntry] = [],
    applyAec: Bool = true
  ) async -> [TranscriptSegment] {
    state = .processing
    inProgressSegments = []
    defer { state = .idle }

    NSLog(
      "[MeetingCoordinator] transcribeFile starting (mic=%@, system=%@, diarise=%@, removeFillers=%@, vocab=%d, applyAec=%@)",
      audioPath,
      systemAudioPath ?? "<none>",
      diarise ? "true" : "false",
      removeFillers ? "true" : "false",
      customVocabulary.count,
      applyAec ? "true" : "false"
    )

    // Defensive lazy-load. `loadModels()` eagerly loads Cohere at
    // startup; this guard handles the case where the eager load
    // failed mid-startup but the model files became available later
    // (e.g., user retried after a network hiccup). Idempotent +
    // non-throwing.
    if !transcriptionService.isCohereModelLoaded {
      await transcriptionService.loadCohereModel()
    }

    // Phase-8r: post-stop transcription is Cohere-only. The Parakeet
    // engine option is gone — Parakeet is now reserved for live
    // streaming during the meeting (one stream per channel). For
    // post-stop quality, Cohere produces better output and runs in
    // chunks with proper AEC.
    //
    // Mic pass — segments tagged "You" when dual-track, untagged
    // (nil) when single-track. Stream into in-progress list.
    //
    // AEC: only the mic pass uses it, and only in dual-track mode
    // (we pass `aecReferencePath: systemAudioPath`). For single-
    // track the reference is nil and the AEC step inside the
    // service skips silently. The system pass below never gets a
    // reference — there's no echo of system-into-system to cancel.
    let micSpeaker: String? = systemAudioPath != nil ? "You" : nil
    let micSegments = await transcriptionService.transcribeEntireFile(
      audioPath: audioPath,
      speaker: micSpeaker,
      diarise: diarise,
      removeFillers: removeFillers,
      customVocabulary: customVocabulary,
      aecReferencePath: systemAudioPath,
      applyAec: applyAec,
      onProgress: { [weak self] segment in
        self?.inProgressSegments.append(segment)
      }
    )

    var allSegments = micSegments
    if let sysPath = systemAudioPath {
      let sysSegments = await transcriptionService.transcribeEntireFile(
        audioPath: sysPath,
        speaker: "Speaker",
        diarise: diarise,
        removeFillers: removeFillers,
        customVocabulary: customVocabulary,
        // No AEC on the system stream — no reference signal that
        // would make sense (you can't cancel system out of itself).
        aecReferencePath: nil,
        applyAec: false,
        onProgress: { [weak self] segment in
          self?.inProgressSegments.append(segment)
        }
      )
      allSegments.append(contentsOf: sysSegments)
      // Phase-7.5: trigram + gap-aware reconciliation across the
      // two streams. Time-sort gives us chronological order, but
      // when AEC partially missed echo bleed (or two speakers
      // overlap mid-sentence), the same words can appear in BOTH
      // streams' transcripts. Naive sort interleaves them as
      // duplicates. `TranscriptOverlapMerge` walks adjacent
      // same-direction-of-speech segments and dedups via trigram
      // anchoring on the boundary tail — Muesli's reference
      // approach.
      //
      // Apply per-speaker run: only segments with the same speaker
      // label are candidates for overlap dedup (don't merge "You"
      // with "Speaker"; even if the words match, they're distinct
      // utterances by attribution).
      allSegments = mergeOverlappingByRun(allSegments)
    }

    NSLog(
      "[MeetingCoordinator] transcribeFile complete — %d segments (%d mic + %d system)",
      allSegments.count,
      micSegments.count,
      allSegments.count - micSegments.count
    )
    return allSegments
  }

  /// Walk a chronologically-sorted segment list and dedup
  /// overlapping content within same-speaker runs via
  /// `TranscriptOverlapMerge`. Used to reconcile mic + system
  /// post-stop transcripts in dual-track mode (Phase-7.5).
  ///
  /// Algorithm:
  ///   1. Sort by absolute start time.
  ///   2. Walk forward. For each segment, look back at the previous
  ///      segment with the SAME speaker. If the previous segment's
  ///      end time is ≥ current segment's start (overlap by time)
  ///      OR they're adjacent within 0.5 s (sentence may have
  ///      spilled across), feed both texts to `TranscriptOverlapMerge`
  ///      and replace previous's text with the merged result.
  ///      Drop the current segment entirely (its text is now in
  ///      the previous one).
  ///   3. If no overlap candidate, just keep the current segment.
  ///
  /// 0.5 s gap tolerance: experimentally, Whisper's chunk-boundary
  /// sentence breaks fall within this window — segments that *are*
  /// continuations of each other rather than truly separate
  /// utterances.
  private func mergeOverlappingByRun(
    _ segments: [TranscriptSegment]
  ) -> [TranscriptSegment] {
    guard segments.count > 1 else { return segments }

    let sorted = segments.sorted { lhs, rhs in
      parseStartSeconds(lhs.start) < parseStartSeconds(rhs.start)
    }

    var output: [TranscriptSegment] = []
    output.reserveCapacity(sorted.count)

    let adjacencyTolerance: Double = 0.5

    for seg in sorted {
      let segStart = parseStartSeconds(seg.start)
      // Look back through output to find the most recent
      // same-speaker segment that overlaps or is adjacent.
      var mergedInto: Int?
      for i in stride(from: output.count - 1, through: 0, by: -1) {
        let prev = output[i]
        if (prev.speaker ?? "") != (seg.speaker ?? "") { continue }
        let prevEnd = parseStartSeconds(prev.end)
        if prevEnd + adjacencyTolerance < segStart { break }
        // Overlapping or adjacent — merge.
        let mergedText = TranscriptOverlapMerge.mergePair(
          prev: prev.text,
          next: seg.text
        )
        // Skip merge if it didn't actually dedup anything (the
        // helper falls back to "prev + space + next" when no
        // overlap is detectable). In that case the right move is
        // to keep both segments distinct, not stuff them into
        // one bubble.
        let plainConcat = prev.text + " " + seg.text
        if mergedText.count < plainConcat.count {
          // Real dedup happened. Replace prev with the merged
          // version, extending its end to the later of the two.
          let prevStart = parseStartSeconds(prev.start)
          let extendedEnd = max(parseStartSeconds(seg.end), prevEnd)
          output[i] = TranscriptSegment(
            start: formatTime(prevStart),
            end: formatTime(extendedEnd),
            text: mergedText,
            quality: prev.quality,
            speaker: prev.speaker
          )
          mergedInto = i
        }
        break
      }
      if mergedInto == nil {
        output.append(seg)
      }
    }

    return output
  }

  func getStatus() -> MeetingStatus {
    MeetingStatus(
      state: state.rawValue,
      duration: duration,
      // Expose in-progress segments during BOTH live recording and
      // the post-stop file pass:
      //   - `.recording`  → drafts from Whisper-tiny live pipeline
      //                     (quality = "draft", speaker = "You")
      //   - `.processing` → final segments from Whisper-large-v3
      //                     streaming chunk by chunk
      // The UI distinguishes them via the `quality` field. Idle
      // returns nothing — drafts are visually retained client-side
      // between stop and transcribe via React local state.
      segments: (state == .recording || state == .processing)
        ? inProgressSegments
        : [],
      error: lastError,
      liveSystemAudioAvailable: liveSystemAudioAvailable
    )
  }
}
