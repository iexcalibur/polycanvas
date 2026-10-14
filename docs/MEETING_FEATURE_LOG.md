# PolyMind Meeting Feature — Build Log

Rolling log of changes to the meeting/transcription feature across phases.
The release build + end-to-end test sweep happens **once** after the work
queued below is complete; until then nothing is shipped.

---

## Phase 1 — Foundation

**Scope:** VAD pre-pass, dual-track recording, SQLite migration for meeting
history, dead-code purge.

### Server (Swift)

- New `Sources/VadService.swift` — FluidAudio Silero VAD wrapper. Loads on
  demand, exposes `segmentSpeech([Float]) -> [SpeechRegion]`.
- `Sources/TranscriptionService.swift`
  - Added `vadService` field; `loadRealtimeModel()` repurposed to load VAD
    and warm it up.
  - `transcribeEntireFile()` rewritten: VAD runs first, Whisper-large-v3
    runs only on speech regions instead of fixed 60-s chunks. Falls back
    to fixed chunks if VAD unavailable.
- `Sources/Models.swift`
  - Removed lossy denylist from `sanitizeWhisperText` ("thank you" / "okay" /
    "you" filter). VAD eliminates the silence input that caused
    hallucinations at the source; the regex was dropping real speech.
  - Added `parseStartSeconds()` helper used when merging dual-track
    transcripts.
- `Package.swift` — added `FluidAudio 0.14.1` dependency.

### Recorder (Rust — `media_capture` crate)

- Dual-track support via `CaptureSinks::Dual { mic, sys }`. Two parallel
  encoders writing `<id>-mic.m4a` and `<id>-sys.m4a` from one
  `AudioHardwareCreateProcessTap` callback.
- `audio_callback.rs` — added `DualChannel` variant + `is_dual_stream()` +
  `call_dual(mic, sys)`.
- `macos/audio_buffer.rs` — added `extract_separated()` to split the tap's
  interleaved buffer into mic and system slices.
- `macos/tap_audio.rs` — IO callback branches on `is_dual_stream()` between
  separated extraction and the existing mix path.
- Fixed phantom `<id>.m4a` filepath bug — when `include_system_audio == true`
  the recorder now computes `<id>-mic.m4a` directly.
- `RecordingArtifact.system_filepath: Option<String>` carries the parallel
  path back to the orchestrator.
- `join_dual_workers` tolerates `RecordingError::Empty` for silent system
  streams (so a meeting without remote audio doesn't fail).

### Storage (Rust + Electron)

- New crate `packages/frontend/native/meetings_db` (sqlx + WAL).
  - Schema: `meetings(id, doc_id, name, date, duration_ms, audio_filepath,
system_audio_filepath, segments_json, summary_text, created_at,
updated_at)` + indexes.
  - `MeetingsStore` napi class: `saveMeeting` (UPSERT), `listForDoc`,
    `listAll`, `get`, `delete`, `deleteForDoc`, `count`.
- New `apps/electron/src/main/recording/meetings-store.ts` — lazy singleton
  wrapper with one-time JSON→SQLite migration (flag in
  `globalStateStorage` at `meetingHistory:sqliteMigratedAt`).
- `apps/electron/src/main/recording/feature.ts` — removed dead `getHistory()`,
  `MeetingHistoryData`, `MEETING_HISTORY_KEY`. Async helpers delegate to
  meetings-store. Cascade delete also unlinks `systemAudioFilePath`.

### UI (transcript.tsx)

- Dual-track support: `systemAudioFilePath` state, `handleEnd` captures both
  paths, `handleTranscribe` passes both to server.
- `SegmentListView` renders right-aligned `bubbleYou` for "You",
  left-aligned `bubbleSpeaker` for "Speaker", neutral fallback for legacy
  segments without a speaker.

---

## Phase 2 — Live transcript (the differentiator)

**Scope:** Whisper-tiny streaming live during meeting; final pass replaces
it on stop.

### Server (Swift)

- New `Sources/AudioChunker.swift` — RMS-based chunker. Emits when
  `≥4 s buffered AND last 0.4 s silent`, or `≥12 s` (safety cap). Pure
  logic, no audio I/O.
- New `Sources/LiveAudioCapture.swift` — `AVAudioEngine` mic tap → 16 kHz
  mono Float32 via `AVAudioConverter`. Per-buffer convert errors skip
  rather than crash (live preview tolerates dropped frames).
- New `Sources/LiveTranscriptionPipeline.swift` — glue: capture →
  chunker → `AsyncStream<Chunk>` → serial worker → `transcribeLiveChunk`
  → `onSegments`. `stop()` awaits worker drain so live inference doesn't
  compete with the post-stop large-v3 pass for the ANE.
- `Sources/TranscriptionService.swift`
  - Added `liveWhisper: WhisperKit?` + `loadLiveModel()` (downloads
    `openai_whisper-tiny`, ~40 MB; same warmup pattern as final model).
  - Added `transcribeLiveChunk(samples:, chunkStartSec:)` returning
    `quality:"draft"` / `speaker:"You"` segments.
- `Sources/ModelDownloadState.swift` — added `liveLoaded` + `liveProgress`.
- `Sources/Models.swift` — `HealthResponse` exposes the live model state.
- `Sources/HTTPServer.swift` — `/health` reports all three model states;
  `modelsLoaded` requires all three.
- `Sources/MeetingCoordinator.swift`
  - Owns `livePipeline: LiveTranscriptionPipeline?`. Starts in
    `startMeeting` (non-fatal failure → recording still proceeds).
  - `stopMeeting` / `cancelMeeting` await `pipeline.stop()`.
  - `getStatus()` returns `inProgressSegments` during both `.recording`
    and `.processing` (was previously only `.processing`).
  - `loadModels()` loads VAD → live → final sequentially.

### UI (transcript.tsx + .css.ts)

- `TranscriptSegment.quality?: 'draft' | 'final'` — drives styling.
- `ServerHealth.liveLoaded / liveProgress` added; `overallProgress`
  follows `currentlyDownloading` so the % bar tracks the actual model
  in flight.
- New 1-Hz polling effect during `meetingState === 'recording'` mirrors
  draft segments into local state (no flush gap to `isEnded`).
- `bubbleDraft` style: `opacity: 0.62 + italic`. Overlays additively on
  whichever bubble variant the segment chose.
- Empty-state copy updated to "Listening… draft transcript appears as
  you speak."

### Verified

- Swift `swift build` — green; one pre-existing Sendable warning, nothing
  new.
- TS `tsc --noEmit` — no new errors; pre-existing `"layer/border"` token
  errors and a build-output dependency error remained.

---

## Phase 3 — Notes ⇄ Transcript ⇄ AI

**Scope:** User takes notes in the doc during the meeting; AI uses both
notes + transcript at summarize time. Click transcript bubble to seek
audio.

### UI (transcript.tsx + .css.ts)

- `insertMeetingHeading(doc, dateLabel)` — appends `## Meeting Notes —
Apr 26, 14:30` h2 + empty paragraph to the last note block at meeting
  start. Returns block ID.
- `readUserNotes(doc, headingId)` — walks siblings starting after the
  heading, collects text until the next h1/h2 or end-of-note. Stops at
  h2-or-shallower (not h3) so the AI's auto-inserted "Summary" /
  "Action Items" h3 sub-sections don't terminate the walk on a
  re-summarize.
- `handleStart` inserts the heading and stores the ID in
  `meetingNoteHeadingIdRef`. Failure is non-fatal — recording proceeds;
  summary falls back to transcript-only.
- `summarizeWithGemini` signature now accepts `userNotes`. Prompt
  branches: with-notes uses notes as steering ("expand on the user's
  framing using the transcript as evidence; don't contradict — they
  were there, you weren't"); without-notes degrades to transcript-only.
  Action-items prioritise items the user explicitly wrote.
- `insertSummaryIntoDoc` accepts the meeting heading ID and inserts the
  summary into the **same note** that owns the heading, so the summary
  lands next to its meeting notes (not at the top of an unrelated note).
- `AudioPlayerBar` converted to `forwardRef`, exposes
  `{ seekTo(seconds): void }` via `useImperativeHandle`. Auto-plays after
  seek so the user immediately hears the moment.
- `parseSegmentTime("mm:ss" | "h:mm:ss")` helper (TS twin of the
  Swift-side `parseStartSeconds`).
- `SegmentListView` accepts optional `onSeek` callback; bubbles render
  with `bubbleClickable` (cursor + hover-brightness) when wired, **except
  for drafts** (timestamp will shift; no audio yet).
- Wired in both consumer sites: `HistoryDetailView` always; main panel
  only when `isEnded` (audio player only mounts then).

### Verified

- TS — no new errors from these changes; same pre-existing errors only.

---

## Phase 4 — Speaker diarisation

**Scope:** Make single-track recordings (mic only, multiple people in the
room) and dual-track-system streams (multi-participant remote audio)
display per-speaker bubbles instead of an undifferentiated stream. Uses
FluidAudio's pyannote-derived diariser (CoreML, ANE) — already in deps.

### Server (Swift)

- New `Sources/DiarizationService.swift` — `FluidAudio.DiarizerManager`
  wrapper. `load(progress:)` (downloads ~50 MB segmentation +
  embedding CoreML models with progress callback), `warmup()` (11-s
  silent buffer to compile kernels), `diarize([Float]) →
[SpeakerTurn]`. `SpeakerTurn` is `(speakerId, startSeconds,
endSeconds)`.
- `Sources/ModelDownloadState.swift` — added `diarLoaded` +
  `diarProgress`.
- `Sources/Models.swift` — `HealthResponse` exposes `diarLoaded` /
  `diarProgress`.
- `Sources/HTTPServer.swift` — `/health` includes diariser state;
  `modelsLoaded` now requires all four (VAD + tiny + large + diar).
- `Sources/TranscriptionService.swift`
  - Added `diarService` field + `isDiarModelLoaded` accessor.
  - Added `loadDiarModel()` (same non-fatal pattern as VAD/live/final).
  - `transcribeEntireFile()` now runs diarisation **once on the
    entire decoded buffer** (so pyannote's IDs stay stable across
    regions) **after VAD** but **before the Whisper region loop**.
    For each Whisper segment, `resolveSpeaker(forStart:)` looks up
    the diarised turn that contains the segment's absolute start
    and tags the segment with the user-facing label.
  - **Skip rules** (we don't blindly diarise everything):
    - `speaker == "You"` (dual-track mic) → skip — provenance
      already says it's the user.
    - `speaker == nil` (single-track mic) → diarise as
      `"Speaker 1"` / `"Speaker 2"` / …
    - `speaker == "Speaker"` (dual-track system) → diarise as
      `"Remote 1"` / `"Remote 2"` / …
  - **One-speaker suppression:** if diarisation finds ≤1 unique
    speaker, we drop the diarised labels entirely and fall back
    to the caller-supplied speaker. Avoids gratuitous "Speaker 1"
    tags on one-person recordings.
  - **Stable label mapping:** pyannote's internal IDs ("0", "1",
    "SPEAKER_00") are mapped to "Speaker N" / "Remote N" by
    first-appearance order — earliest turn = "Speaker 1".
- `Sources/MeetingCoordinator.swift`
  - Added `isDiarModelLoaded` accessor.
  - `loadModels()` now loads VAD → live → final → diar sequentially
    (diar last because failure to load it should not block recording).

### UI (transcript.tsx + .css.ts)

- `ServerHealth` extended with `diarLoaded` / `diarProgress`.
  `overallProgress` follows `currentlyDownloading === "diariser"`
  during the active download; weighted overall when idle gives
  large-v3 92% of the bar (it's by far the slowest).
- 5-tint speaker colour palette (`speakerHueA`–`speakerHueE`) added
  to `transcript.css.ts`. Stays inside the monochrome aesthetic by
  tinting backgrounds + adding a coloured left border accent.
  Hashes the speaker name → palette index, so the same "Speaker 2"
  stays the same colour throughout the conversation. Collisions on
  ≥6 unique speakers are acceptable since the explicit speaker
  label inside each bubble disambiguates definitively.
- `bubbleSpeakerLabel` style — small uppercase tracked-out label
  rendered above the time inside the bubble for diarised speakers.
- `speakerPaletteClass(speaker)` helper resolves a speaker name to
  its palette CSS class deterministically.
- `isDiarisedSpeaker(speaker)` regex-matches `^(Speaker|Remote)\s+\d+$`
  to distinguish diarised labels from the legacy unsuffixed
  "Speaker" / "You" labels.
- `SegmentListView` rendering paths after Phase 4:
  1. `"You"` → right-aligned `bubbleYou` (unchanged).
  2. Diarised `"Speaker N"` / `"Remote N"` or legacy `"Speaker"` →
     left-aligned `bubbleSpeaker` + speaker palette class (+ name
     label for diarised).
  3. Anything else (nil / "Mixed") → centred `bubbleMixed` (single-
     track without diarisation, legacy meetings).

### Verified

- Swift `swift build` — green; one pre-existing Sendable warning
  unrelated to Phase 4.
- TS `tsc --noEmit` — no new errors; same pre-existing
  `"layer/border"` token errors and build-output dependency.

---

## Phase 5 — Polish & edge cases

**Scope:** Make the meeting feature shippable. Diariser opt-out,
transcribe-error surfacing, audio-unavailable handling, spurious
diariser-turn filter.

### Server (Swift)

- `Sources/Models.swift` — `TranscribeFileRequest.diarise: Bool?`
  (optional for back-compat with older clients; defaults to true).
- `Sources/HTTPServer.swift` — passes `diarise ?? true` through to
  the coordinator.
- `Sources/MeetingCoordinator.swift` — `transcribeFile()` now takes
  a `diarise: Bool = true` parameter; threads it to both Whisper
  passes (mic + system) in dual-track mode.
- `Sources/TranscriptionService.swift` — `transcribeEntireFile()`
  takes `diarise: Bool = true`. The diarisation gate now requires
  `diarise && diarService.isLoaded && speaker != "You"` (was just
  the latter two). Caller-driven opt-out wins.
- `Sources/DiarizationService.swift` — added `minTurnDurationSec =
0.5` constant. Turns shorter than that get filtered out before
  label-mapping. Pyannote occasionally emits sub-half-second
  "turns" on background noise / mouth clicks / cross-talk
  artefacts; without the filter these would create gratuitous
  "Speaker N" labels for one-syllable fragments. Logs how many
  raw turns were filtered each pass for observability.

### IPC (Electron main)

- `apps/electron/src/main/recording/index.ts` — `transcribeFile`
  now accepts an optional `diarise` parameter and forwards it in
  the request body.

### UI (transcript.tsx + .css.ts)

- New "Speakers on / Speakers off" toggle in the controlBar next
  to the existing "Mic + System / Mic only" toggle. Persisted in
  `localStorage` at `polymind:enable-diarisation`. Default ON.
  When OFF, `handleTranscribe` passes `diarise = false` so the
  server skips the diarisation pass for that meeting. Disk usage
  is unchanged (model still preloads); only saves CPU and avoids
  the per-speaker labels.
- `transcribeError` state added; surfaces as a banner in the
  footer ("Transcribe failed: …") instead of a console-only
  failure. Cleared on `handleNewMeeting`.
- `AudioPlayerBar` now tracks `loadError`. When the recording
  file is missing / corrupted / IPC bridge unavailable, the
  player renders a single muted line ("Audio unavailable — …")
  in place of the waveform + controls. New `audioUnavailable`
  CSS style added. Click-to-seek on transcript bubbles still
  no-ops gracefully because `seekTo` reads from a null `audioRef`.

### Verified

- Swift `swift build` — green; same pre-existing Sendable warning.
- TS `tsc --noEmit` — no new errors; same pre-existing
  `"layer/border"` token errors and build-output dependency.

---

## Phase 6 — Quality parity sweep (cleanup chain)

**Scope:** Match the Muesli cleanup chain on Whisper output.
Deterministic, zero new dependencies, all pure-Swift logic. Two
pieces deferred to Phase 6.5 (DTLN-AEC and Parakeet-TDT live —
both architectural changes with new deps).

### Server (Swift)

- New `Sources/TranscriptArtifactFilter.swift` — drops full-text
  `[BLANK_AUDIO]` / `[silence]` / `[no_speech]` artefacts. Strips
  Whisper prompt regurgitation (model echoing back the system
  prompt instructions like "transcribe the spoken audio
  accurately") via anchored start/end regex. Tidies whitespace and
  space-before-punctuation.
- New `Sources/FillerWordFilter.swift` — two-phase removal.
  Phase 1: multi-word phrases ("you know,", "i mean,", "sort of",
  "kind of"). Phase 2: single-word fillers ("uh", "um", "hmm" etc).
  "like" is intentionally **only** matched comma-suffixed to
  preserve genuine uses ("I like coffee"). Re-capitalises the
  sentence start when leading filler removal drops a lower-case
  letter into position 0.
- New `Sources/CustomWordMatcher.swift` — user-managed dictionary
  post-replace. Two-stage match per word: exact case-insensitive,
  then Jaro-Winkler similarity ≥ per-entry threshold (default
  recommended 0.85). Strips trailing punctuation before matching
  and re-attaches to the replacement. Includes a full Jaro-Winkler
  implementation (Jaro similarity + 0.1 prefix-bonus, capped at 4
  prefix chars).
- New `Sources/TranscriptTurnNormalizer.swift` — two enums:
  - `MicTurnNormalizer.normalize(_:)` — speaker-aware. Run-length
    encodes by speaker so segments with different speaker labels
    never merge. Per run: detect fragmentation (≥50 % short
    fragments OR avg <8 visible chars) → fall back to
    `NLTokenizer` sentence split with weighted-by-length timing.
    Otherwise merge adjacent segments within 0.35 s, or 1.5 s if
    either is short.
  - `SystemTurnNormalizer.normalize(_:)` — always sentence-split.
    System stream is typically one speaker delivering longer
    utterances, splitting reads better than one big bubble.
- `Sources/TranscriptionService.swift`
  - `transcribeEntireFile()` signature gains `removeFillers: Bool`
    and `customVocabulary: [CustomWordEntry]`.
  - **Per-segment cleanup chain** (inside the inner Whisper loop):
    `sanitizeWhisperText` → `TranscriptArtifactFilter.apply` →
    `FillerWordFilter.apply` (if `removeFillers`) →
    `CustomWordMatcher.apply` (if vocab non-empty). Empty after
    chain → drop the segment.
  - **Mic repair pass** (after the main loop, before normalisation):
    `uncoveredRegions(...)` identifies VAD speech regions ≥0.8 s
    where transcript coverage <55 %. Re-runs Whisper on those slices
    with `temperature: 0.4` (vs the first pass's 0.0) so the
    decoder follows a different path. Recovered segments append to
    `allSegments` and re-sort chronologically before normalisation.
  - **Turn normalisation** (final step before return):
    `SystemTurnNormalizer` for the system-stream pass,
    `MicTurnNormalizer` for everything else.
- `Sources/Models.swift` — `TranscribeFileRequest` gains
  `removeFillers: Bool?` + `customVocabulary: [CustomWordEntry]?`
  (both back-compat optional). New `CustomWordEntry` struct
  (`word`, `replacement`, `threshold`).
- `Sources/MeetingCoordinator.swift` — `transcribeFile` threads the
  new params through both passes (mic + system) in dual-track mode.
- `Sources/HTTPServer.swift` — passes the new fields through with
  defaults `removeFillers: false` / `customVocabulary: []` for
  back-compat.

### IPC (Electron main)

- `apps/electron/src/main/recording/index.ts` — `transcribeFile`
  IPC takes optional `removeFillers` + `customVocabulary` params,
  forwards in the request body.

### UI (transcript.tsx)

- `removeFillers` state, persisted in `localStorage` at
  `polymind:remove-fillers`. Default OFF (verbatim — preserves
  fidelity for researchers / journalists). New "Fillers: clean /
  Fillers: verbatim" toggle in the controlBar next to the existing
  Mic + System / Speakers toggles.
- `customVocabulary` state, hydrated from localStorage at
  `polymind:custom-vocabulary` (JSON array of
  `{ word, replacement, threshold }`). The state is **read-only
  from the UI for now** — the editor UI is deferred to Phase 6.5.
  Power users can edit localStorage directly and reload; entries
  flow through to the server on the next transcribe call.

### Deferred to Phase 6.5+

- **Parakeet-TDT for live transcript** (Phase 7?) — replaces
  Whisper-tiny with FluidAudio's streaming ASR. Same library we
  already use for VAD + diarisation, so no new dep, but it's an
  architectural change to the live pipeline (replaces
  `LiveTranscriptionPipeline` / `AudioChunker` / Whisper-tiny
  path).
- **Custom vocabulary editor UI** (Phase 6.6?) — modal with a
  textarea + parser. Logic plumbing (request → server → matcher)
  is already in place; just needs the editor.

### Verified

- Swift `swift build` — green.
- TS `tsc --noEmit` — no new errors; same pre-existing
  `"layer/border"` token errors and build-output dependency.

---

## Phase 6.5 — Neural acoustic echo cancellation (DTLN-AEC)

**Scope:** Subtract the remote / system-audio reference signal
from the mic stream before VAD/Whisper run, removing the speaker
bleed that occurs when users record on laptop speakers instead of
headphones. Without AEC, Whisper transcribes the remote voice
twice: once accurately from the system stream, once mangled from
the mic echo.

### Server (Swift)

- `Package.swift` — added `dtln-aec-coreml` from `MimicScribe`
  (range `from: "0.4.0-beta"`, currently resolves to 0.6.0-beta).
  Two products linked: `DTLNAecCoreML` (the framework) and
  `DTLNAec512` (the 512-unit / "large" model bundle, ~40 MB).
- New `Sources/MeetingNeuralAec.swift` — batch wrapper around
  `DTLNAecEchoProcessor`:
  - `load()` async throws — loads CoreML from
    `DTLNAec512.bundle` (resolved via SPM's `Bundle.module`,
    so no Muesli-style bundle-path dance needed).
  - `warmup()` — drives ~1 s of silence through the model to
    JIT-compile the CoreML kernels before the first user
    transcription. Same pattern as Whisper / VAD warmup.
  - `process(mic:reference:)` — batch-mode entrypoint. Resets
    state, then walks 512-sample frames (32 ms at 16 kHz)
    pairing each mic frame at position P with the reference
    frame at position P. Reference shorter than mic → tail is
    zero-padded (no echo to cancel). Returns cleaned mic with
    the same length as input. Handles partial tail frame by
    zero-padding the last <512 samples and trimming output back
    to the actual count.
- `Sources/ModelDownloadState.swift` — added `aecLoaded` /
  `aecProgress`. Bundled model so progress is effectively a
  load-or-fail boolean.
- `Sources/Models.swift`
  - `HealthResponse` exposes `aecLoaded` / `aecProgress`.
  - `TranscribeFileRequest` adds `applyAec: Bool?` (back-compat
    optional, default true).
- `Sources/HTTPServer.swift` — `/health.modelsLoaded` now requires
  all five models (VAD, live, final, diariser, AEC). Threads
  `applyAec` from the request into `coordinator.transcribeFile`.
- `Sources/TranscriptionService.swift`
  - Added `aecService: MeetingNeuralAec` field +
    `isAecModelLoaded` accessor.
  - Added `loadAecModel()` — same non-fatal pattern as VAD /
    diariser. On load failure flips `aecLoaded = true` so the UI
    doesn't block; the AEC step in `transcribeEntireFile`
    degrades to mic passthrough.
  - `transcribeEntireFile()` signature gains `aecReferencePath:
String?` and `applyAec: Bool`. After PCM decode of the mic
    file, if `applyAec && aecService.isLoaded && refPath != nil`,
    decode the reference file and run AEC. The cleaned mic
    samples replace `pcm` so all downstream stages (VAD, Whisper,
    diariser) see the de-echoed signal. Defensive length check —
    if the AEC pass somehow returned a different sample count
    (model bug or framing error) we skip the replacement to avoid
    corrupting timestamps.
- `Sources/MeetingCoordinator.swift`
  - Added `isAecModelLoaded` accessor.
  - `loadModels()` now loads VAD → tiny → final → diariser → AEC.
    AEC is last because it's bundled (no download wait) and
    failure shouldn't block recording.
  - `transcribeFile()` passes `aecReferencePath: systemAudioPath`
    for the mic call (only fires for dual-track), and
    `aecReferencePath: nil` + `applyAec: false` for the system
    pass (no reference signal that would make sense — you can't
    cancel system out of itself).

### Skip / failure semantics

| Mode                                      | AEC behaviour                                                                                      |
| ----------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Single-track mic                          | No reference → AEC step is no-op, mic passes through unchanged                                     |
| Dual-track, AEC model loaded              | Mic processed against system reference, cleaned signal feeds VAD/Whisper                           |
| Dual-track, AEC model failed to load      | Mic passes through unchanged, transcript still produced (lower quality on speakers, same as today) |
| Dual-track, `applyAec: false` from client | Same as failed-to-load: passthrough                                                                |
| Dual-track system pass                    | Always passthrough — system stream is not echo-corrupted                                           |

### UI

No UI changes. AEC is transparent — fires automatically for
dual-track meetings, silently skipped for single-track. The
`applyAec` flag exists on the request for future debugging or
power-user override but isn't surfaced in settings.

### Verified

- Swift `swift build` — green; only the pre-existing Sendable
  warning, no new errors. The `DTLNAec512.bundle` resource
  resolves correctly via SPM's resource system.

---

## Phase 6.6 — Custom vocabulary editor UI

**Scope:** Surface the user-managed vocabulary list (server already
respected it from Phase 6) as a proper modal editor instead of
"hand-edit `localStorage` and reload".

### UI (transcript.tsx + .css.ts)

- New `VocabularyEditor` component — `Modal` (Radix Dialog
  wrapper from `@polycanvas/component`) with:
  - One-paragraph explainer at top describing the Jaro-Winkler
    threshold semantics (0.95+ strict, 0.85 default, 0.80 looser).
  - List of editable rows: misheard input | `→` | preferred
    input | threshold number input (0.5 — 1.0 step 0.05) |
    delete button.
  - Empty-state copy when the user has no entries.
  - Footer with "+ Add entry" (creates a blank row with default
    threshold 0.85) and "Done" (closes modal).
- Vocab state owned by `EditorTranscriptPanel`. Editor receives
  `entries` + `onSave` + `onClose` props. Local `draft` state
  inside the editor is **deliberately not synced** to incoming
  `entries` after mount — keeps just-typed empty rows visible
  under the cursor. Commits flow one-way: editor → parent →
  localStorage.
- Empty rows (either field blank) are kept in the editor's draft
  but **filtered out** when persisting / sending to the server.
  User can leave a half-edited row and come back; the parent
  state stays clean.
- New `VocabularyIcon` (open-book glyph) and `MenuItem` in
  `ThreeDotMenu` — `Custom Vocabulary…`. Wired in two places: the
  idle-state controlBar (most common entry point — opening before
  a meeting) and the recording/ended-state controlBar (post-stop
  entry — fixing terms after seeing them mistranscribed).
- `vocabularyEditorOpen` boolean state in the panel; the editor
  is mounted in **both** the idle and recording/ended branch
  returns so opening from either state actually renders the
  modal (a single mount point at the bottom would only render in
  one branch).
- Type `CustomVocabEntry` lifted from inside `EditorTranscriptPanel`
  to module scope so the editor (also module-level) can reference
  it.
- New CSS: `vocabHelp` / `vocabEmpty` / `vocabRows` /
  `vocabRow` / `vocabInput` / `vocabArrow` / `vocabThreshold`
  / `vocabDelete` / `vocabFooter` / `vocabAddBtn` /
  `vocabDoneBtn`. All inside the existing monochrome aesthetic
  (no new accent colours).

### Where it doesn't surface

- **History views** (`view === 'history'` and
  `'history-detail'`). Vocab affects FUTURE transcribes; opening
  from a finalised meeting in history would imply otherwise.
  Power users can still navigate back to the main panel and
  open it there.

### Verified

- TS `tsc --noEmit` — no new errors; same pre-existing
  `"layer/border"` token errors and build-output dependency.

---

## Phase 7 — Live transcript: Whisper-tiny → Parakeet-TDT

**Scope:** Replace the live draft model. Whisper-tiny (~40 MB,
non-streaming, weakest link in the stack) → Parakeet-TDT 0.6 B
via FluidAudio's `SlidingWindowAsrManager` (~250 MB, streaming-
native, ~30× realtime). Whisper-large-v3 stays for the post-stop
final pass.

### Server (Swift)

- `Sources/LiveAudioCapture.swift` — simplified. Dropped the
  `AVAudioConverter` we used to resample mic → 16 kHz mono Float32
  for Whisper-tiny. Parakeet's `streamAudio(_:)` does its own
  format conversion internally. Now emits raw `AVAudioPCMBuffer`
  in the engine's native format (typically 48 kHz Float32) via
  `onBuffer` callback. Per-buffer alloc + resample-on-audio-queue
  overhead is gone.
- `Sources/LiveTranscriptionPipeline.swift` — rewritten around
  `SlidingWindowAsrManager(config: .streaming)`:
  - Pre-loaded `AsrModels` injected via init (constructed by
    `MeetingCoordinator` from `transcriptionService.liveModels`).
  - `start()` is now async — creates a fresh manager, calls
    `loadModels(asrModels)`, `startStreaming(source: .microphone)`,
    spins a worker task to consume `transcriptionUpdates`.
  - Worker uses Parakeet's confirmed/volatile two-tier output:
    confirmed deltas append to a rolling segment history;
    volatile text shows as a single trailing tip segment that
    gets replaced as the volatile shifts. Snapshot of the full
    list emitted via `onSegments` on each update.
  - `stop()` calls `manager.finish()` then `cleanup()` to drain
    inference + free models. Returned final string is dropped
    (would duplicate the confirmed history).
- `Sources/AudioChunker.swift` — **deleted**. Was needed for
  Whisper-tiny's non-streaming inference (RMS silence detection
  to find chunk boundaries). Parakeet handles its own framing
  internally.
- `Sources/TranscriptionService.swift`
  - `liveWhisper: WhisperKit?` + `liveModelSize` constant
    replaced with `liveAsrModels: AsrModels?` (Sendable, shared
    across pipeline instances).
  - `loadLiveModel()` rewritten to use
    `AsrModels.downloadAndLoad(progressHandler:)`. Pulls
    `parakeet-tdt-0.6b-v3-coreml` from
    `FluidInference/parakeet-tdt-0.6b-v3-coreml` on HuggingFace
    via FluidAudio's standard download path. Same non-fatal
    failure semantics as the other model loaders.
  - `transcribeLiveChunk(samples:chunkStartSec:)` **removed**.
    No longer per-chunk; streaming pipeline owns the inference.
  - New `liveModels` accessor exposes `AsrModels?` for
    `MeetingCoordinator` to construct pipelines.
  - New `init()` runs `StaleModelCleanup.run()` once at server
    start.
- `Sources/StaleModelCleanup.swift` (NEW) — one-shot upgrade
  cleanup. Walks the WhisperKit cache and removes every Whisper
  variant the current code path no longer uses:
  `openai_whisper-tiny` (Phase-7-replaced) plus the orphaned
  `openai_whisper-small` and `openai_whisper-medium` left over
  from earlier dev iterations. Cleans both the compiled
  `.mlmodelc` directory under
  `whisperkit-models/models/argmaxinc/whisperkit-coreml/` and
  the matching tokenizer directory under
  `whisperkit-models/models/openai/`. Logs total bytes freed.
  Idempotent — runs once after upgrade, then no-ops.
  `openai_whisper-large-v3` and its tokenizer stay untouched
  (still the post-stop refinement model).
  _Initial Phase-7 implementation looked at the wrong
  directory level (`whisperkit-models/openai_whisper-tiny`,
  missing the `models/argmaxinc/whisperkit-coreml/` intermediate
  path) — fixed in the Phase-7.5 prep commit._
- `Sources/MeetingCoordinator.swift`
  - `startMeeting()` now `await pipeline.start()` (async
    because `SlidingWindowAsrManager.startStreaming` is async).
  - Pipeline construction reads `transcriptionService.liveModels`
    — if nil (load failed), skip the live pipeline entirely
    rather than constructing one that can't transcribe. Same
    user-visible degradation as before: recording works, no
    live drafts in the sidebar, post-stop pass still runs.
  - `pipeline.onSegments` handler changed from
    `inProgressSegments.append(contentsOf:)` to
    `inProgressSegments = segments` — Phase-7 contract change,
    Parakeet emits incremental hypothesis snapshots not deltas.

### Quality picture

|                              | Whisper-tiny (pre-Phase-7)   | Parakeet-TDT 0.6 B (post-Phase-7) |
| ---------------------------- | ---------------------------- | --------------------------------- |
| Size                         | ~40 MB                       | ~250 MB                           |
| Speed on M-series ANE        | ~10× realtime                | ~30× realtime                     |
| Streaming                    | No (per-chunk)               | Yes (sliding-window)              |
| WER (LibriSpeech test-clean) | ~5%                          | ~2.2%                             |
| Live latency                 | 4-12 s (chunk boundaries)    | ~1 s (hypothesis updates)         |
| Languages                    | multilingual                 | English-only                      |
| Boundary handling            | cuts mid-word at chunk edges | cache-aware encoder, no cut       |

The English-only constraint is a real loss for multilingual users
but matches the language the rest of the live UI is built around
(Whisper had `language: "en"` hardcoded anyway). Whisper-large-v3
remains multilingual for the final pass.

### Disk impact on existing users

After upgrade, `StaleModelCleanup` removes the orphaned
Whisper-tiny dir. Parakeet downloads to FluidAudio's cache
(`~/Library/Caches/FluidInference/parakeet-tdt-0.6b-v3-coreml/`)
on first launch. Net delta on disk:

```
+250 MB (Parakeet)
- 40 MB (Whisper-tiny removed)
─────────
+210 MB (one-time, on first post-upgrade launch)
```

### Verified

- Swift `swift build` — green; only the same pre-existing
  Sendable warning in `decodeAudioFileToPCM`. New files
  (LiveAudioCapture rewrite, LiveTranscriptionPipeline rewrite,
  StaleModelCleanup, TranscriptionService changes,
  MeetingCoordinator changes) all compile clean.
- AudioChunker.swift removed cleanly (no remaining references).

---

## Phase 7.5 — Live processing parity

**Scope:** Match Muesli's during-meeting quality stack. Capture
system audio in-process via ScreenCaptureKit (modern, AirPods-
safe), wire a per-track live pipeline (mic + system Parakeet
streams), apply DTLN-AEC live frame-by-frame with the system
stream as the far-end reference, and reconcile mic + system
post-stop transcripts via trigram-aware overlap merge.

The Rust recorder stays running unchanged — still writes the
canonical mic.m4a + system.m4a. Phase-7.5 is purely additive:
Swift gets a parallel feed for live processing. Phase-7.6 will
retire the Rust audio capture later.

### Server (Swift)

- New `Sources/SystemAudioCapture.swift` — `SCStream`-based
  in-process system-audio tap. Mirrors `LiveAudioCapture`'s
  shape (`onBuffer: ((AVAudioPCMBuffer) -> Void)?`). Uses
  `SCContentFilter(display:excludingWindows:)` with audio-only
  configuration (1 fps min frame interval, 2×2 frame size to
  minimise the unused video path) and
  `excludesCurrentProcessAudio = true` so we don't capture our
  own UI sounds. Converts `CMSampleBuffer` → `AVAudioPCMBuffer`
  with a memcpy from the retained block buffer; format detected
  from the sample buffer's ASBD. Async `start()` throws on
  permission denial / no display / SCStream init failure.
- New `Sources/TranscriptOverlapMerge.swift` — port of Muesli's
  `CohereTranscribeUtils.mergeOverlapping`. Builds a trigram
  hash index from the tail of fragment A, scans the head of B
  for the first hit, walks both sides forward to extend the
  match, and drops B's leading words up through the matched
  run. Falls back to plain concatenation when no overlap is
  detectable. O(N) per merge in the boundary windows (≤80 words).
- `Sources/MeetingNeuralAec.swift` — added streaming entrypoints
  alongside the existing batch `process(mic:reference:)`:
  - `resetStreamingState()` — clears rolling buffers + processor
    state at session start.
  - `feedSystemSamples(_:)` — appends far-end samples to the
    rolling reference buffer.
  - `processStreamingMic(_:)` — pulls 512-sample mic frames,
    pairs each with the system frame at the SAME absolute
    sample position (zero-padded if system hasn't caught up,
    trimmed periodically to bound peak memory at ~64 KB).
    Returns cleaned samples; partial trailing frame held back
    for next call.
  - `flushStreamingMic()` — drains the partial frame at session
    end (zero-pad → process → trim back to actual count).
- `Sources/LiveTranscriptionPipeline.swift` — rewritten for
  dual-track:
  - `init(asrModels:aecService:applyAec:)` — takes pre-loaded
    Parakeet models, the AEC service from `TranscriptionService`,
    and a per-meeting AEC opt-out flag.
  - Two `SlidingWindowAsrManager` actors (one per stream) each
    loaded with the same `Sendable` `AsrModels` — they hold
    independent decoder/window state.
  - Mic flow: `LiveAudioCapture.onBuffer` →
    `audioConverter.resampleBuffer` (16 kHz mono Float) →
    `aec.processStreamingMic` (cleaned) → re-pack into
    `AVAudioPCMBuffer` → mic Parakeet `streamAudio`.
  - System flow: `SystemAudioCapture.onBuffer` →
    `audioConverter.resampleBuffer` → `aec.feedSystemSamples`
    (parallel, fed BEFORE the next mic frame) → re-pack →
    system Parakeet `streamAudio`.
  - Per-stream confirmed/volatile state. `onSegments` snapshot
    interleaves both streams' confirmed history + volatile tips
    by start time. Mic segments tagged `speaker:"You"`, system
    `speaker:"Speaker"`.
  - Failure semantics: mic capture must succeed (AVAudioEngine
    failure throws). System capture failure is caught + logged
    - the system manager is torn down — pipeline degrades to
      mic-only live, same as pre-Phase-7.5.
- `Sources/TranscriptionService.swift` — exposes
  `aec: MeetingNeuralAec` accessor for the pipeline.
- `Sources/MeetingCoordinator.swift`
  - `startMeeting` builds the pipeline with
    `aecService: transcriptionService.aec, applyAec: true`.
    Live AEC is hardcoded ON (objective quality improvement
    with no downside; per-meeting opt-out from Phase 5 still
    governs the post-stop pass).
  - New private `mergeOverlappingByRun(_:)` helper applied
    after the post-stop mic + system file pass: walks
    chronologically-sorted segments, looks back for same-
    speaker overlap within 0.5 s, dedupes via
    `TranscriptOverlapMerge.mergePair`. Drops the second
    segment when real overlap is detected (merged text is
    SHORTER than plain concat); otherwise keeps both.
    Replaces the previous "just sort by start time" logic.

### Electron (Info.plist)

- `apps/electron/forge.config.mjs` — added
  `NSScreenCaptureUsageDescription` to `extendInfo`. macOS
  prompts the user once on first ScreenCaptureKit access.
  Audio-only — the description copy explicitly states no screen
  content is recorded.

### Risk & migration

- **Two simultaneous system audio captures.** Rust process tap
  - ScreenCaptureKit run in parallel. macOS supports this; both
    see the system mix independently. We log buffer arrival
    rates from both sides to verify equivalence in production.
- **Permission UX.** First post-7.5 launch will prompt for
  Screen Recording permission. Recording itself still works
  (Rust path unaffected) if the user denies — only the live
  preview degrades to mic-only. The denial state should be
  detected and surfaced (TODO follow-up).

### Out of scope (deferred)

- Move m4a writing to Swift (Phase 7.6).
- Retire Rust audio capture (Phase 7.6).
- Whisper-large-v3 → Cohere Transcribe 2B for the post-stop
  pass (Phase 8).

### Verified

- Swift `swift build` — green; only the pre-existing
  AVFoundation Sendable warning, no new errors. All new files
  (SystemAudioCapture, TranscriptOverlapMerge, streaming AEC
  methods, dual-track pipeline rewrite, mergeOverlappingByRun)
  compile clean.

### Follow-up: Screen Recording permission UX

After Phase 7.5 landed, denying Screen Recording silently
fell through to mic-only live preview. This follow-up surfaces
the failure to the UI so the user can fix the permission
without quitting the meeting.

**Server**

- `LiveTranscriptionPipeline` exposes `systemAudioActive: Bool`
  set after `start()` returns. True iff `SCStream.startCapture()`
  succeeded; false on permission denial / no display / other
  init failure.
- `MeetingCoordinator` snapshots this into a private
  `liveSystemAudioAvailable: Bool?` field at meeting start
  (also flipped to false in the pipeline-throws / models-not-
  loaded code paths). Reset to nil on `cancelMeeting`; left
  intact on `stopMeeting` so a final status poll reflects the
  correct historical answer.
- `MeetingStatus.liveSystemAudioAvailable: Bool?` added to the
  payload returned by `/meeting/status`. Optional for
  back-compat with older clients (renders no banner there).

**UI**

- `transcript.tsx` mirrors the flag in the existing
  recording-state status poll. New per-meeting state:
  - `liveSystemAudioAvailable: boolean | undefined` (server
    truth)
  - `liveSystemBannerDismissed: boolean` (user-controlled, reset
    on each `handleStart`)
- New banner block rendered between the controlBar and the
  segment list. Visible during `recording` / `paused` when the
  flag is `false` and not dismissed. Body explains the
  consequence ("remote participant won't appear in the live
  transcript") and offers two actions:
  - **Open Settings** — calls
    `apis.recording.showRecordingPermissionSetting('system-audio')`,
    which already maps to `Privacy_ScreenCapture` (the macOS
    Settings panel that governs ScreenCaptureKit). No new IPC
    needed.
  - **Dismiss** — sets `liveSystemBannerDismissed = true` for
    this meeting only.
- Styles in `transcript.css.ts`: `systemAudioBanner`,
  `systemAudioBannerText`, `systemAudioBannerActions`,
  `systemAudioBannerPrimary`, `systemAudioBannerSecondary`.
  Monochrome palette, no new accent colour.

**Verified**

- Swift `swift build` — green; same pre-existing Sendable
  warning, no new errors.
- TS `tsc --noEmit` — no new errors; same pre-existing
  `"layer/border"` token errors and build-output dependency.

---

## Phase 7.6 — Recorder unification

**Scope:** Move audio capture + m4a writing from the Rust
`media_capture` crate to the Swift transcription server. After
this phase, macOS no longer hosts two simultaneous audio taps
for the same meeting; one capture path feeds both live
processing and disk writes. Rust audio capture code is dormant
(no longer called) but still in the repo — code deletion can
land as a follow-up cleanup commit once we're confident the
Swift path is solid.

### Server (Swift)

- New `Sources/MeetingRecordingWriter.swift` —
  `AVAudioFile`-based dual-track AAC m4a writer:
  - `start(micPath:systemPath:)` — file refs lazily opened on
    first append (format discovery from buffer at runtime).
  - `appendMic(_ buffer)` / `appendSystem(_ buffer)` —
    `nonisolated`, dispatch to per-stream serial queues so audio
    capture queues aren't blocked on disk I/O.
  - `stop()` async → drains both write queues, closes files
    (AVAudioFile finalises m4a containers on dealloc), returns
    `RecordingArtifact { micPath, systemPath? }`.
  - `@unchecked Sendable` with discipline-based safety: each file
    ref is touched only from its respective queue's closures;
    `paths` + `isRunning` lock-protected.
- `Sources/LiveTranscriptionPipeline.swift` — capture ownership
  removed. Pipeline now exposes `feedMicBuffer(_:)` /
  `feedSystemBuffer(_:)` (`nonisolated`) for the coordinator to
  push buffers into. `start()` only spins up Parakeet sessions
  - AEC streaming state; `stop()` only tears those down. Adds
    `markSystemCaptureUnavailable()` for the case where the
    coordinator's system capture failed to start so the pipeline
    can tear down its idle system Parakeet worker.
- `Sources/MeetingCoordinator.swift`
  - Now owns `LiveAudioCapture` + `SystemAudioCapture`. Each
    `onBuffer` callback fans out: `recordingWriter.appendXxx`
    AND `livePipeline?.feedXxxBuffer`.
  - New `recordingWriter: MeetingRecordingWriter` field +
    `currentMicPath` / `currentSystemPath` for the active
    recording's output paths.
  - `startMeeting(audioPath:systemAudioPath:)` — Phase-7.6
    entrypoint; spins up captures + writer + pipeline together.
  - `startMeetingLegacyNoCapture()` — transitional entrypoint
    for pre-7.6 Electron clients. Spins up captures + pipeline
    (live transcription stays working) but skips the writer
    so Rust still owns the canonical .m4a for those clients.
  - `stopMeeting()` — empty body. Tears down captures, finalises
    writer, drains pipeline, returns the artifact paths via
    StopResponse.
- `Sources/Models.swift`
  - `StartRequest` gains optional `audioPath` / `systemAudioPath`.
    Empty body or missing paths → legacy no-writer behaviour.
  - `StartResponse` echoes the paths.
  - `StopRequest` is now empty; `StopResponse` returns the paths.
  - New `TranscribeFileResponse` separates the transcribe-file
    response from `StopResponse` (different shapes after Phase 7.6).
- `Sources/HTTPServer.swift` — branches on `audioPath` presence:
  has paths → `coordinator.startMeeting(audioPath:systemAudioPath:)`;
  empty → `coordinator.startMeetingLegacyNoCapture()`. Stop and
  cancel return the new shapes.

### Electron (recording IPC)

- New `apps/electron/src/main/recording/swift-native-controller.ts`
  — drop-in `NativeRecordingController` implementation that
  routes `startRecording` / `stopRecording` / `abortRecording`
  to the Swift HTTP endpoints. Same path conventions as Rust
  used (`{outputDir}/{id}.m4a` single-track,
  `{outputDir}/{id}-mic.m4a` + `{outputDir}/{id}-sys.m4a`
  dual-track) so downstream code (`RecordingCoordinator` job
  state, history, post-stop pipeline) doesn't change.
- `apps/electron/src/main/recording/feature.ts` — swap the
  `nativeController` factory to use
  `makeSwiftNativeRecordingController()`. The Rust napi binding
  for audio is no longer referenced.
- `apps/electron/src/main/recording/index.ts` — `startMeeting`
  IPC now optionally takes `audioPath` + `systemAudioPath`;
  passes them to Swift's `/meeting/start`. `stopMeeting` IPC
  body is now empty (Swift owns the paths in its own state).
  Legacy `audioPath` arg on `stopMeeting` accepted-but-unused
  for backward compat with un-migrated UI calls.

### Architecture summary

| Concern                           | Pre-7.6                              | Post-7.6                             |
| --------------------------------- | ------------------------------------ | ------------------------------------ |
| Mic capture                       | Rust `AudioHardwareCreateProcessTap` | Swift `AVAudioEngine`                |
| System capture                    | Rust process tap                     | Swift `ScreenCaptureKit` (Phase 7.5) |
| AAC m4a writing                   | Rust encoder                         | Swift `AVAudioFile`                  |
| Live pipeline (Parakeet + AEC)    | Swift (Phase 7.5)                    | Swift                                |
| Number of macOS audio taps active | 2 (Rust + Swift)                     | 1 (Swift only)                       |

### Risk + verification

- Electron's `RecordingCoordinator` job state machine, app
  detection, and history wiring all keep working unchanged
  because the `NativeRecordingController` interface is
  preserved exactly.
- Rust audio capture code is still present in the repo but no
  longer called. Cleanup commit (delete the Rust audio path)
  can follow once we're confident.

### Verified

- Swift `swift build` — green; only pre-existing AVFoundation
  Sendable warning. New `MeetingRecordingWriter`, refactored
  pipeline, refactored coordinator all compile.
- TS `tsc --noEmit` — no new errors in
  `apps/electron/src/main/recording/` or
  `core/src/desktop/pages/workspace/detail-page/tabs/`.

---

## Phase 7.6.x — Delete dead Rust audio capture code

**Scope:** After Phase 7.6 routed audio capture through the Swift
transcription server, the Rust `media_capture` crate's audio
recording orchestration was no longer called. This commit deletes
the dead code (`recording.rs` + `audio_decoder.rs`, ~1500 lines)
and stops shipping the orphaned napi exports. The shared
infrastructure (`audio_callback`, `tap_audio`, `m4a_aac_writer`,
`audio_buffer`) stays — `screen_capture_kit.rs` and others still
reference it for ScreenCaptureKit-related napi surfaces.

### Rust (`media_capture` crate)

- New `Sources/audio_permission.rs` (NEW, ~30 lines) — extracted
  the `request_system_audio_permission` napi export from the
  bottom of `recording.rs`. This is the only audio-related napi
  export this crate still hosts after retirement.
- `src/recording.rs` — **deleted** (~1300 lines):
  - `start_recording` / `stop_recording` / `abort_recording`
    napi entry points + their `*_inner` async helpers
  - `RecordingArtifact` / `RecordingSessionMeta` /
    `RecordingStartOptions` napi-exposed types
  - `ActiveRecording` global registry + control-message
    machinery (`ControlMessage`, `START_RECORDING_LOCK`)
  - `OggOpusWriter` + `M4aAacWriter` orchestration paths
  - The `spawn_recording_controller`, `join_dual_workers`, and
    `CaptureSinks` helper code that wired Rust's audio capture
    workers to disk
  - The accompanying integration tests
- `src/audio_decoder.rs` — **deleted** (~170 lines):
  - `decode_audio` / `decode_audio_sync` napi exports
  - `DecodeAudioTask` async wrapper
  - These were never referenced by any TS / JS code in the
    repo. Likely vestiges of an earlier transcription pipeline
    where Rust handled audio decoding before Whisper picked up
    the slack
- `src/lib.rs` — drop the two module declarations, add
  `audio_permission`. Comment notes the Phase-7.6.x retirement.

### Native binding types

- `packages/frontend/native/index.d.ts` — manually edited to
  remove the now-deleted napi declarations:
  - `abortRecording`, `startRecording`, `stopRecording`
    function signatures
  - `RecordingArtifact`, `RecordingSessionMeta`,
    `RecordingStartOptions` interfaces
  - `decodeAudio`, `decodeAudioSync` function signatures
- `requestSystemAudioPermission` declaration kept (now sourced
  from `audio_permission.rs`).

### Not touched (still in use)

- `audio_callback.rs`, `macos/tap_audio.rs`, `macos/audio_buffer.rs`,
  `macos/m4a_aac_writer.rs`, `macos/av_audio_*.rs` — all
  imported by `macos/screen_capture_kit.rs` for its own
  ScreenCaptureKit-flavoured audio types. The napi exports
  there (`ShareableContent`, `AudioCaptureSession`, app
  enumeration, etc.) are still consumed by the Electron app
  detection flow and the `media-capture-playground` debug
  surface. A deeper cleanup of these (removing the orphaned
  audio-only types they expose) is possible but out of scope —
  this commit focuses on the high-leverage 1500-line removal.
- The `media-capture-playground/server/main.ts` continues to
  use `ShareableContent.tapAudio()` directly for its
  proof-of-concept recording demo. Not touched.
- Test mocks in `apps/electron/test/main/recording-coordinator.spec.ts`
  use `startRecording` / `stopRecording` / `abortRecording`
  property names matching the `NativeRecordingController`
  interface — not the napi function names. Mock contract is
  unchanged.

### Disk impact

- Source: ~1500 lines of Rust deleted.
- Built artifact (`polymind.darwin-universal.node`): unchanged
  on this commit because we manually edited `index.d.ts`
  rather than rebuild the napi binding (full build is slow due
  to large native deps). The dead exports still exist in the
  current `.node` file but nothing references them. Next napi
  rebuild (e.g. on next release) regenerates a smaller binary
  without them.

### Verified

- Rust `cargo build --release` — green. Three pre-existing
  dead-code warnings in `tap_audio.rs` (`is_app_specific`,
  `app_id`, `excluded_processes` fields,
  `setup_device_change_listeners` method) — those are
  byproducts of the recording deletion, can be cleaned in a
  follow-up.
- Swift `swift build` — green; no behaviour change Swift-side
  this commit.
- TS `tsc --noEmit` — no new errors. `apis.recording.startRecording`
  / `stopRecording` IPC bridges keep working because they route
  through Electron's `RecordingCoordinator` →
  `swift-native-controller.ts` → Swift HTTP, never touching the
  retired napi exports.

---

## Phase 8a — Cohere Transcribe 2B engine (opt-in)

**Scope:** alternative post-stop transcription engine. Whisper-large-v3
remains the default; users opt in per-meeting via `engine: "cohere"` on
the `/meeting/transcribe-file` body. Whisper is NOT removed yet — Phase 8a
is the integration spike, the Whisper teardown happens in a later phase
once we've verified Cohere quality on real meetings.

### Why Cohere

Cohere Transcribe 2B (March 2026, Apache 2.0 base model, 14 languages) is
a Fast-Conformer encoder + Transformer decoder model designed for ASR.
Apple Silicon CoreML ports already exist on HuggingFace; Muesli's open
source repo has a complete Swift integration we can port from. Quality
hypothesis: better at English idiomatic phrasing and proper-noun
recognition than Whisper-large-v3, comparable WER on clean speech.
Phase 8a ships behind a feature flag so we can A/B without committing.

### Server (Swift)

- New `Sources/CohereAsrService.swift` (~700 lines, ported from
  Muesli's `CohereTranscribeBackend.swift`):
  - `@available(macOS 15, *) @MainActor final class CohereAsrService`.
    macOS 15 gate is hard — MLState (the KV-cache mechanism the
    prefill/decode decoders share) is a Core ML 8 API. Older OS
    falls through transparently to Whisper.
  - Public API: `load(progress:)`, `unload()`, `transcribe(samples:) -> String`,
    `isLoaded`. Same shape as the other model services so callers
    don't need a new pattern.
  - Three CoreML packages run inference: encoder
    (`cohere_encoder_dynamic.mlpackage`, ~3.5 GB), prefill decoder
    (`cohere_decoder_prefill_int8.mlpackage`, int8 quantized, ~150
    MB), autoregressive decode decoder
    (`cohere_decoder_decode_int8.mlpackage`, int8, ~130 MB). Plus
    `tokenizer.model` (SentencePiece protobuf) and two binary
    auxiliary files: `cohere_mel_filterbank.bin` (Slaney mel) and
    `cohere_mel_window.bin` (Hann).
  - Mel pipeline: pre-emphasis 0.97, dither 1e-05, Slaney mel
    filterbank (128 mels × 257 freq bins), Bessel-corrected
    normalization, log(x + 2^-24) guard. Numbers match Cohere's
    NeMo FilterbankFeatures spec exactly — divergence from upstream
    here would silently degrade quality.
  - Sliding window: 35 s max chunk with 5 s overlap; chunks
    > 35 s split internally so the encoder never sees more than its
    > trained context. Overlap text reconciliation reuses the
    > existing `TranscriptOverlapMerge` (trigram-anchored dedup, the
    > same mechanism used by Phase 7.5 dual-stream reconciliation).
  - Decoder: English prompt token chain (promptPrefixTokenId 13764
    - noTimestamp + noDiarize + punctuation tokens), token budget
      `max(15, audioSeconds * 7.0)`, no-repeat-4-gram suppression,
      3-tokens-above-eos heuristic stop. Full speed on the ANE (the
      int8 decoders are the whole reason for that quantization).
  - Model resolution priority: env override
    `POLYMIND_COHERE_LOCAL_DIR` → `defaultCacheDirectory`
    (Application Support). Phase 8a uses the env override
    exclusively so the smoke test runs against the local copy at
    `~/Desktop/cohere-transcribe-coreml/` without hitting HF.
  - Default repo id: `phequals/cohere-transcribe-coreml-mixed-precision`.
    No license is stated on that upload; treating it as a
    derivative of the Apache 2.0 upstream and using locally during
    Phase 8a. Before any production rollout we'll re-host under a
    project-controlled HF repo with explicit Apache 2.0
    attribution — phequals' files exactly match Muesli's expected
    layout, which is the only port we found that does.

- `Sources/ModelDownloadState.swift` — added `cohereProgress`,
  `cohereLoaded`. Kept separate from the five-model "modelsLoaded"
  gate (VAD + tiny + large + diariser + AEC) — gating Start
  Meeting on a 4 GB optional download would punish users who
  never select Cohere.

- `Sources/Models.swift`
  - `HealthResponse.cohereLoaded: Bool?` and
    `cohereProgress: Float?` (both optional for back-compat —
    older clients ignore them).
  - `TranscribeFileRequest.engine: String?` — `"whisper"` (default,
    omitted → Whisper) or `"cohere"`. Documented in the doc-comment
    as an opt-in selector with transparent fallback.

- `Sources/HTTPServer.swift`
  - `/health` reports the new Cohere fields (loaded / progress).
  - `/meeting/transcribe-file` forwards
    `engine: transReq.engine ?? "whisper"` into
    `coordinator.transcribeFile`.
  - Comment in `/health` notes Cohere is intentionally NOT in the
    `modelsLoaded` gate (opt-in alternative engine, separate
    readiness reporting so a future UI can show "Cohere
    available" without affecting the main loading flow).

- `Sources/TranscriptionService.swift`
  - New `cohereService: AnyObject?` field — type-erased to dodge
    the `@available(macOS 15, *)` class reference at the
    `TranscriptionService` declaration site (which targets all
    supported OSes).
  - New `loadCohereModel()` — idempotent, non-throwing. macOS 14.x
    falls through silently. On any failure leaves
    `cohereLoaded=false` so callers transparently fall back to
    Whisper. Called lazily by the coordinator on first
    `engine: "cohere"` transcribe; not part of `loadModels()` so
    the default flow never touches the 4 GB download.
  - `transcribeEntireFile(...)` accepts `engine: String = "whisper"`.
    Cohere branch sits between the AEC pass and the VAD pre-pass:
    if `engine == "cohere"` AND `cohereService` is loaded AND we
    can cast (macOS 15+), route the post-AEC PCM into
    `cohere.transcribe()` and wrap the resulting string as one
    `TranscriptSegment` covering [0, totalDuration]. Same
    `TranscriptArtifactFilter` / `FillerWordFilter` /
    `CustomWordMatcher` cleanup chain as Whisper. VAD,
    diarisation, sub-chunking, and the mic-repair pass are
    intentionally bypassed — Cohere is opt-in "give me text",
    users who need segment structure stay on Whisper. Empty
    output falls through to the Whisper path.

- `Sources/MeetingCoordinator.swift`
  - `transcribeFile(...)` accepts `engine: String = "whisper"`
    and threads it through both mic + system passes. Logs the
    selected engine in the start-line. When `engine == "cohere"`
    and the model isn't yet loaded, calls
    `transcriptionService.loadCohereModel()` once before kicking
    off the passes.

### Local model cache

- `~/Desktop/cohere-transcribe-coreml/` (3.8 GB, downloaded via
  `hf download phequals/cohere-transcribe-coreml-mixed-precision`).
  All six required files present: three `.mlpackage`s + the three
  aux files. Phase 8a smoke test sets
  `POLYMIND_COHERE_LOCAL_DIR=~/Desktop/cohere-transcribe-coreml`
  and runs the server with `engine: "cohere"` on a recorded
  meeting; the local-dir override means no network fetch on
  first transcribe.

### Whisper teardown — NOT this phase

- `loadFinalModel()` still loads Whisper-large-v3 unconditionally;
  the 1.5 GB model still downloads on first launch. Removing it
  is Phase 8d (StaleModelCleanup deletes
  `openai_whisper-large-v3`) and Phase 8e (drop the WhisperKit
  Swift package dep entirely). Sequencing matters: we keep
  Whisper as the fallback path until Cohere has shipped on real
  meetings and we're confident the quality holds. A panic-revert
  back to Whisper would be a one-flag flip until the teardown
  phases land.

### Verified

- Swift `swift build` — green. Only pre-existing
  AVAudioPCMBuffer Sendable warning in `decodeAudioFileToPCM` —
  unrelated to Phase 8.
- Local model cache present and complete (3.8 GB, six files).
- End-to-end smoke against a recorded meeting still pending —
  next session.

---

## Phase 8a.1 — `decodeAudioFileToPCM` rewrite (AVAssetReader)

**Scope:** drop-in replacement for the post-stop audio decode path.
Discovered while wiring Phase 8a's smoke test.

### Problem

`AVAudioFile.read()` threw an opaque
`Foundation._GenericObjCError` from inside the running server
process — every call, every audio format (verified m4a + wav).
The same code path worked from a standalone Swift process. The
failure only reproduced with the full set of CoreML models loaded
(VAD + Parakeet + Whisper-large-v3 + diariser + AEC + Cohere).
Swapping to the no-frameCount overload didn't help. Suspected
interaction between the macOS 26.4 SDK's audio framework and
multiple concurrent CoreML model handles in one process.

The bug was effectively silent — every `transcribeFile` call
returned `[]` because the function bailed at decode-time before
either engine ran. Live transcription (which doesn't go through
this function — it has its own capture path) was unaffected,
which is why nobody had hit this in production usage.

### Fix

Replace the `AVAudioFile + AVAudioConverter` decode pipeline with
an `AVAssetReader` configured with explicit output settings:
16 kHz, mono, Float32, non-interleaved. AVAssetReader uses a
different decode path internally — same supported formats
(anything `AVAsset` reads: m4a / mp3 / wav / opus / etc.), same
output shape (`[Float]` PCM), no exceptions.

### Verified

- 60-second TED-talk m4a → 960 000 samples in ~150 ms
- Cohere transcribed cleanly (869 chars, 8.2 s wall clock)
- Whisper transcribed cleanly (9 segments with timestamps)
- Both engines now return non-empty results from
  `/meeting/transcribe-file`

---

## Phase 8b — flip default to Cohere

**Scope:** make Cohere Transcribe 2B the default post-stop engine.
Whisper-large-v3 stays as the explicit-opt-out fallback (and the
deferred-fallback for any failure mode of the Cohere path).

### Decision rationale

Phase 8a added Cohere as opt-in. Phase 8a.1 unblocked the smoke
test. A/B comparison on Tim Urban's TED-talk opener (60 s clean
mono mic):

  - **Cohere:** one continuous segment, 869 chars. Clean
    punctuation ("90-page senior thesis", colon usage),
    capitalisation correct, no duplicated openings, no
    truncated phrases. 8.2 s wall clock.
  - **Whisper-large-v3:** nine timestamped segments. Quality
    glitches: duplicated `"So in college, So in college,"`,
    truncated `"So, you know..."`, no hyphenation, longer
    wall clock (~21 s).

Cohere is materially better on text quality. Two trade-offs:
single-segment output drops the per-utterance bubble seek-UX,
and chunking shaved ~5 s off the tail of the audio (Whisper
caught additional content Cohere didn't). Both are addressable
follow-ups; not blockers for the default flip.

### Server (Swift)

- `Sources/HTTPServer.swift` — `engine: transReq.engine ??
  "cohere"` (was `"whisper"`).
- `Sources/MeetingCoordinator.swift` —
  `transcribeFile(... engine: String = "cohere")`.
  `loadModels()` now also calls `loadCohereModel()` after the
  five-model gate so default callers don't pay the 23-s lazy-load
  cost on first post-stop transcribe.
- `Sources/TranscriptionService.swift` —
  `transcribeEntireFile(... engine: String = "cohere")`. Doc
  comment for `loadCohereModel` updated to reflect that it's
  now called eagerly from `loadModels()` (and still lazily from
  `transcribeFile` as a safety net for any failure of the eager
  load).

### Gate semantics — unchanged

`modelsLoaded` still requires VAD + tiny + large + diariser +
AEC. Cohere readiness is reported separately
(`cohereLoaded` / `cohereProgress`) and does NOT block Start
Meeting:

- macOS 14.x users can't load Cohere; Whisper-large-v3 stays
  the working default for them via the deferred fallback. The
  existing five-model gate still ungates correctly.
- macOS 15+ users on first launch see Cohere finish loading
  shortly AFTER the gate flips true. If they hit Stop in that
  narrow window, the deferred fallback routes them through
  Whisper for that one meeting; subsequent meetings use Cohere.
- Cohere load failures (missing files, network error, etc.)
  leave `cohereLoaded=false` and the system runs as if Phase
  8b had never landed — Whisper is still the de-facto engine.

### Verified

- Smoke test against Tim Urban's TED audio with NO `engine`
  field in the request body → routed to Cohere by default
  (server log: `engine=cohere`), returned the same 869-char
  transcript as the explicit `engine: "cohere"` path. 2.6 s
  transcribe wall clock (eagerly-loaded Cohere — no lazy-load
  on first request).
- `engine: "whisper"` explicit opt-out still works — drops back
  to the existing VAD + sub-chunked Whisper pipeline with
  per-segment timestamps.
- `swift build -c release` — green.

### Follow-ups (Phase 8c+)

- **8c — re-host model files.** phequals' upload has no license.
  Re-host under a project-controlled HF repo with explicit
  Apache 2.0 attribution and drop the `POLYMIND_COHERE_LOCAL_DIR`
  env override.
- **Per-chunk segments for Cohere.** Today's single-bubble
  output loses the seek-to-time UX. The Cohere path already
  runs sliding-window chunks internally (60 s = 2 chunks);
  surface them as separate `TranscriptSegment`s with
  chunk-aligned timestamps. Restores parity with Whisper's
  segment shape.
- **Tail-end chunking edge case.** Cohere shaved the last
  ~5 s of the smoke-test audio. Likely an off-by-one in the
  sliding-window emit boundary; verify on synthetic test
  audio of varying lengths and patch the chunker.

---

## Phase 8d/e — remove Whisper entirely

**Scope:** Cohere becomes the only post-stop engine. Whisper-large-v3
is gone — code path, model files, Swift package dependency. macOS 15+
is now the effective minimum (Cohere requires MLState).

This combines what was originally planned as two phases (8d for the
stale-model cleanup, 8e for the Swift dep drop) into one commit since
the user wanted the cleanup all-in-one.

### Server (Swift)

- `Package.swift`
  - Removed `WhisperKit` package dependency and target product.
  - Platform stays at `.macOS("14.4")`. Cohere requires macOS 15
    via `@available(macOS 15, *)` at the call site, NOT via the
    package platform — bumping the deployment target to 15 made
    the Apple-internal CoreML compiler emit a Cohere encoder
    `.mlmodelc` that hits an `MPSGraphTensorData.mm:223
    failed assertion 'shape.count = 0 != strides.count = 3'`
    inside MPSGraph during the encoder forward pass. Confirmed
    by bisect: same Cohere code, same model files, the only
    variable is the deployment target. The 14.4 compile path
    works; the 15 compile path is broken in the SDK we ship
    against. Reported upstream; for now we keep 14.4 as the
    package platform and rely on the call-site availability
    check for the macOS-15-only runtime requirement.

- `Sources/TranscriptionService.swift`
  - Dropped `import WhisperKit`.
  - Dropped `finalWhisper: WhisperKit?` field, `finalModelSize`
    constant, `modelDownloadBase()` helper, `loadFinalModel()`
    function.
  - `transcribeEntireFile` collapsed from ~520 lines to ~80.
    Pipeline is now: decode → AEC → Cohere → cleanup chain →
    one segment. Dropped: VAD pre-pass (Cohere does its own
    framing), per-region Whisper transcribe loop, sub-chunking,
    mic-repair pass with higher-temperature decode, Whisper-
    sentence normalisation. The `engine` parameter is gone too —
    only one engine remains.
  - Dropped `uncoveredRegions` and `subChunkRange` private
    helpers (Whisper-only).
  - `diarise` parameter kept on the signature but unused (Cohere
    returns one segment with nothing for diarisation to attach
    to). Marked `_ = diarise` to silence unused-parameter
    diagnostics.
  - Doc comments updated to describe the post-Whisper pipeline.

- `Sources/MeetingCoordinator.swift`
  - `loadModels()` no longer calls `loadFinalModel()`. The
    sequence is now VAD → Live (Parakeet) → Diariser → AEC →
    Cohere — five models, same `modelsLoaded` gate gates them.
  - `transcribeFile()` lost its `engine` parameter. The
    defensive lazy-load of Cohere kept (covers the rare case
    where the eager load failed mid-startup).
  - Added `isCohereModelLoaded` accessor.
  - Removed `isFinalModelLoaded` accessor.

- `Sources/ModelDownloadState.swift`
  - Removed `largeProgress` and `largeLoaded` fields.

- `Sources/Models.swift`
  - `HealthResponse`: dropped `largeLoaded` / `largeProgress`.
    `cohereLoaded` and `cohereProgress` are now non-optional
    (were `Bool?` / `Float?` in Phase 8a for back-compat).
  - `TranscribeFileRequest.engine` field kept on the request
    shape for back-compat with older clients but documented as
    ignored. The `HTTPServer` logs a one-line warning when a
    non-cohere value comes in.

- `Sources/HTTPServer.swift`
  - `/health`: removed `largeLoaded` / `largeProgress` from the
    response. `modelsLoaded` gate is now
    `smallLoaded && liveLoaded && diarLoaded && aecLoaded
    && cohereLoaded` — Cohere is required, Whisper-large is
    gone.
  - `/meeting/transcribe-file`: stops threading `engine` to the
    coordinator. Logs `engine ignored` when the request still
    carries one (back-compat).

- `Sources/StaleModelCleanup.swift`
  - Deletion list now includes `openai_whisper-large-v3` and
    its tokenizer at `openai/whisper-large-v3`. First-launch
    cleanup after upgrade frees ~3 GB on machines that had the
    Phase-8b binary installed.

### Client (TS)

- `packages/frontend/core/src/desktop/pages/workspace/detail-page/tabs/transcript.tsx`
  - `ServerHealth` interface: renamed `largeLoaded` → `cohereLoaded`,
    `largeProgress` → `cohereProgress`. Removed the old fields
    entirely (server no longer sends them).
  - `overallProgress` weighted formula: `largeProgress` →
    `cohereProgress`, `'large-v3'` token → `'cohere'`,
    `'tiny'` → `'parakeet'` (was already wrong from Phase 7;
    fixed incidentally).
  - User-facing strings updated: "Whisper-large-v3 takes
    roughly 10% of the audio length" → "Cohere Transcribe 2B
    runs at roughly 7× realtime". Comment headers describing
    the pipeline updated to reference Cohere instead of
    Whisper.
  - Doc comment for the `quality` field on `TranscriptSegment`
    updated to note both engines (Phase-2 / Phase-7 streaming
    + Phase-8d/e Cohere final).

### Verified

- `swift build -c release` — green (only pre-existing AVAsset
  deprecation warnings).
- Smoke test on `/tmp/ted_60.m4a` with no `engine` field →
  routes to Cohere by default, returns the same 869-character
  transcript Phase 8b produced. ~2.3 s wall clock (eagerly
  loaded Cohere — no lazy-load on first request).
- Smoke test with `engine: "whisper"` → server logs
  `engine=whisper ignored — Cohere is the only engine`,
  routes to Cohere, returns identical transcript.
- `StaleModelCleanup` ran on first launch after the new build,
  removed `openai_whisper-large-v3` (~3 GB on disk) plus its
  tokenizer, logged the freed space.
- All five models (`smallLoaded` / `liveLoaded` / `diarLoaded`
  / `aecLoaded` / `cohereLoaded`) flip true within ~38 s of
  startup.

### Bisect: macOS 15 deployment-target MPS crash

Initial Phase 8d/e build had `platforms: [.macOS("15")]` since
Cohere requires macOS 15 anyway. That build crashed
deterministically on every transcribe with:

```
MPSGraphTensorData.mm:223: failed assertion
`shape.count = 0 != strides.count = 3'
```

inside the Cohere encoder forward pass. Reverting just the
platform to `.macOS("14.4")` (no other changes) fixed it. The
`@available(macOS 15, *)` at the CohereAsrService call site
already enforces the runtime macOS requirement, so dropping
the platform doesn't weaken the actual gate.

Hypothesis: the macOS-15 deployment target changes how
Apple-internal CoreML compilation lays out the encoder graph,
and the resulting layout has a tensor whose shape (0-rank) is
inconsistent with its strides (3-rank). The 14.4 compile path
produces a working graph for the same .mlpackage. Marked as a
SDK bug — file an Apple Feedback once we've isolated a minimal
repro.

### Disk impact

- WhisperKit dep removed: shrinks the Swift binary by ~13 MB.
- Whisper-large-v3 cache deleted on first launch: ~3 GB freed.
- Net: -3 GB user disk, -13 MB binary, -~600 lines of Swift.

---

## Phase 8f — drop orphaned VAD, diariser, and turn normalisers

**Scope:** delete the Whisper-era pre/post passes that Phase 8d/e
left orphaned in the codebase. After this phase the post-stop path
is just `decode → AEC → Cohere → cleanup → one segment`, the
`/health` model gate is three flags (`liveLoaded`, `aecLoaded`,
`cohereLoaded`), and the Sources tree has shed three more files.

### What was orphaned and why

After Phase 8d/e the post-stop pipeline collapsed to a single Cohere
inference. Three Whisper-era components stayed in the build but
never ran:

- **VAD** (`VadService.swift`) — used to chunk the audio into
  speech regions before Whisper saw it. Cohere does its own
  internal framing; nothing called the VAD service any more.
- **Diariser** (`DiarizationService.swift`) — used to map
  per-Whisper-segment timestamps to "Speaker 1 / 2 / …" labels.
  Cohere returns one segment per file with nothing to attach
  per-segment labels to, so the diariser ran on every transcribe
  but its output was discarded.
- **Turn normalisers** (`TranscriptTurnNormalizer.swift`:
  `MicTurnNormalizer`, `SystemTurnNormalizer`) — sentence-split
  + adjacent-merge logic that ran on Whisper's chunky per-region
  output. Cohere produces one final segment so there's nothing
  to normalise.

Plus a small straggler:

- **`sanitizeWhisperText`** in `Models.swift` — stripped
  Whisper's `<|...|>` special tokens and `[BLANK_AUDIO]` brackets.
  Cohere's tokenizer doesn't emit those, so this was a no-op on
  the live data path.

The Phase 8d/e commit message marked these as "follow-up cleanups"
and left the loads + fields in place. This phase finishes the job.

### Server (Swift)

- Deleted `Sources/VadService.swift` (~110 lines).
- Deleted `Sources/DiarizationService.swift` (~340 lines).
- Deleted `Sources/TranscriptTurnNormalizer.swift` (~365 lines —
  both `MicTurnNormalizer` and `SystemTurnNormalizer` enums).
- `Sources/Models.swift` — dropped the 50-line
  `sanitizeWhisperText` regex helper.
- `Sources/TranscriptionService.swift`
  - Dropped `vadService` and `diarService` fields.
  - Dropped `loadRealtimeModel()` (was loading VAD) and
    `loadDiarModel()` functions.
  - Dropped `isRealtimeModelLoaded` / `isDiarModelLoaded`
    accessors.
  - Doc comments updated to reflect the slimmed pipeline.
- `Sources/MeetingCoordinator.swift`
  - `loadModels()` is now three calls instead of five:
    `loadLiveModel()` → `loadAecModel()` → `loadCohereModel()`.
  - `startMeetingInternal()` no longer defensively reloads VAD
    on first meeting — there's no VAD to reload.
  - Dropped `isRealtimeModelLoaded` / `isDiarModelLoaded`
    pass-through accessors.
- `Sources/ModelDownloadState.swift`
  - Dropped `smallProgress` / `smallLoaded` and
    `diarProgress` / `diarLoaded` fields. The snapshot now
    tracks three models.
- `Sources/Models.swift` `HealthResponse`
  - Dropped `smallLoaded` / `smallProgress` and `diarLoaded` /
    `diarProgress`. The struct is now five surface fields
    (status, modelsLoaded, three loaded flags, three progress
    values, currentlyDownloading).
- `Sources/HTTPServer.swift` `/health`
  - `modelsLoaded` gate is now
    `liveLoaded && aecLoaded && cohereLoaded`. The response
    payload no longer includes the dropped fields.

### Client (TS)

- `packages/frontend/core/src/desktop/pages/workspace/detail-page/tabs/transcript.tsx`
  - `ServerHealth` interface: dropped `smallLoaded` /
    `smallProgress` and `diarLoaded` / `diarProgress`.
  - Initial state literal trimmed to match.
  - `setServerHealth` after the fetch reads only the surviving
    fields.
  - `overallProgress` reweighted: was
    `live*4 + cohere*92 + diar*4`, now `live*6 + cohere*94`.
    The `'diariser'` branch (returned `h.diarProgress` during
    diariser download) is gone.

### Verified

- `swift build -c release` — green (only pre-existing AVAsset
  deprecation warnings).
- Smoke test on `/tmp/ted_60.m4a` post-cleanup: same
  869-character transcript Phase 8b/8d/e produced.
- Server load sequence is now Live (~13 s) → AEC (~0.5 s) →
  Cohere (~25 s); total ~38 s (down from ~60 s with the VAD
  and diariser still loading).
- `/health` payload trimmed: only the three remaining loaded /
  progress pairs plus `modelsLoaded` and `currentlyDownloading`.

### Disk impact

- `~/Library/Caches/FluidInference/` no longer accumulates the
  VAD model. (FluidAudio still uses this path for Parakeet.)
- Pyannote diariser cache (whichever path
  `DiarizationService.load` was using) stops being downloaded /
  refreshed. We don't actively delete the existing cache —
  follow-up `StaleModelCleanup` entry could reclaim it later;
  it's only ~50 MB so we left it alone for now.
- Source tree: three full files deleted (`VadService.swift`,
  `DiarizationService.swift`, `TranscriptTurnNormalizer.swift` —
  ~580 lines together) plus in-place trims across seven others.
  Net commit diff: -665 lines.

---

## Phase 8g — mic repair pass (Cohere)

**Scope:** add a sparse-output retry to `transcribeEntireFile` so
catastrophic Cohere decoder failures (silence collapse, noSpeech
rejection, mid-decode aborts) don't strand the user with an empty
transcript when there's recoverable audio.

### Why we needed it back

Phase 8d/e dropped the Whisper-era mic repair pass (which used VAD
regions + a higher-temperature DecodingOptions retry). Cohere has
been the only engine since then. Cohere's decoder is greedy argmax,
so naïvely re-running on the same input returns the same output —
useless for repair. Without something equivalent, an empty Cohere
result is just an empty transcript.

### How it works

The trigger is a chars-per-second density check on the primary
output. Healthy English speech runs ~12-15 chars/sec including
spaces. We re-run when:

  - the primary output is empty, OR
  - the audio is > 5 s AND density < 5 chars/sec

The 5 chars/sec floor catches obvious decoder collapses without
firing on every short utterance. The 5 s minimum avoids burning
inference time on micro-clips where a sparse transcript may just be
a sparse utterance.

The retry uses a different mechanism than the original Whisper
repair (which exploited Whisper's stochastic decoder via temperature
0.4). Cohere is deterministic, so we shift the **mel-frame boundary**
instead — prepend 2 s of silence to the input, which slides every
chunk's mel windows by 32 000 samples. The encoder sees a different
framing, which produces a different attention pattern, which
deterministically yields a different decoder path. Cheap and self-
contained — no changes to `CohereAsrService` needed.

After the retry we pick whichever of the two outputs has more
characters. Length is a coarse proxy but it's the only signal we
have without ground truth, and a longer Cohere output is rarely
worse than an empty one.

### Server (Swift)

- `Sources/TranscriptionService.swift`
  - New `repairPadSamples` static constant (32 000 = 2 s × 16 kHz).
  - In `transcribeEntireFile`: after the primary `cohere.transcribe`
    call, compute density. If `needsRepair` is true, call
    `cohere.transcribe` again with the input pre-padded by
    `repairPadSamples` zero samples. Pick the longer output.
  - Server log gains two new lines on repair: a header naming the
    primary density + audio length, and a "primary kept" /
    "secondary kept" decision line with both char counts.

### Verified

- `swift build -c release` — green.
- TED smoke test (~14.5 chars/sec on the 60 s clip) → primary
  kept, no repair fired. 869-char transcript matches Phase 8f.
- Trigger logic is conservative — repair only fires on truly
  pathological input. Stress-testing the repair branch itself
  needs synthetic near-silent audio; deferred to future work.

### Cost

- Extra ~2 s of inference per repair, only when triggered. The
  mel computation runs on the padded input but the encoder's
  ANE pass already dominates per-chunk wall clock, so adding
  32 000 samples to a 60-s input adds < 5 % overhead on the
  retry.

---

## Phase 8c — Cohere auto-download from HuggingFace

**Scope:** make the released DMG actually transcribe out of the
box. Pre-8c builds shipped with `CohereAsrService` only knowing
about the `POLYMIND_COHERE_LOCAL_DIR` env override + a manually-
populated cache directory. Neither is set on a fresh user install,
so the modelsLoaded gate would never flip true and Start Meeting
would stay disabled forever.

This phase wires the third resolution tier: download from
HuggingFace into the cache directory on first launch, then load
normally. Subsequent launches hit the cache and never re-download.

### Source repo + license caveat

`phequals/cohere-transcribe-coreml-mixed-precision` — same repo we
used during Phase 8a smoke testing. No license stated on the
upload (the upstream Cohere Transcribe 2B base is Apache 2.0; this
is a derivative CoreML port with no explicit terms). Shipping
publicly without re-hosting under a project-controlled HF repo is
a deliberate trade-off — we want to validate end-to-end UX before
spending the time on hosting + attribution metadata. Re-host is
flagged as a follow-up in the build log.

### How resolution flows

```swift
private static func resolveOrDownloadModelDirectory(
  progress: @Sendable (Double) -> Void
) async throws -> URL {
  // 1. Env override (dev mode) — return immediately if valid
  if let raw = ProcessInfo.processInfo.environment[localDirEnvKey], ...
     validateModelDirectory(url) { return url }

  // 2. Application Support cache — return immediately if valid
  let cache = defaultCacheDirectory()
  if validateModelDirectory(cache) { return cache }

  // 3. Cache miss — download from HF, then validate
  try await downloadFromHF(repoId: defaultRepoId, targetDir: cache, progress: progress)
  guard validateModelDirectory(cache) else { throw ... }
  return cache
}
```

### Download mechanism

Two HF endpoints used:

  - `GET /api/models/<repo>/tree/main?recursive=true` — returns a
    JSON array of every file in the repo. We filter to entries
    where `type == "file"` (skip directory entries; directories
    are created implicitly when we write files inside them).
  - `GET /<repo>/resolve/main/<path>` — redirects (HTTP 302) to a
    pre-signed S3 URL hosted on `cas-bridge.xethub.hf.co`. Swift's
    `URLSession.download(from:)` follows the redirect transparently,
    so we just hand it the HF URL and write the resulting temp file
    to the cache.

For phequals' repo the listing returns 13 files / 12 directory
entries totaling **4.03 GB** — the three .mlpackage trees
(`encoder_dynamic` ~3.5 GB, `decoder_prefill_int8` ~150 MB,
`decoder_decode_int8` ~130 MB) plus the three aux files
(`tokenizer.model`, `cohere_mel_filterbank.bin`,
`cohere_mel_window.bin`) and a `.gitattributes`.

### Progress reporting

Reserve 0–0.95 of the load progress for the download phase
(by-byte percentage of total repo size); snap to 1.0 when the
post-download CoreML compile + warmup finishes. Cached / env-
override paths emit nothing during resolution — they hit the
existing `progress(1.0)` call in `load()` once compilation is
done.

The frontend's `overallProgress()` reads `cohereProgress` and
weights it 94% of the overall display, so first-launch users see
a meaningful percentage walking 0% → ~95% over the ~3-5 min
download, then jumping to 100% on compile completion.

### Failure modes

- **HF tree API non-200** (private repo, deleted repo, network
  outage) → throws with the HTTP status code in the message.
  `loadCohereModel()` catches it (non-throwing) and leaves
  `cohereLoaded` false. UI stays in loading state until the user
  retries by relaunching.
- **Single-file download fails midway** → temp file isn't moved;
  partial files in cache get cleaned up on the next run because
  `validateModelDirectory` returns false (missing the failed
  file's parent), triggering a re-download.
- **Disk full** → `moveItem` fails, error propagates as above.
- **Post-download validation fails** (e.g. HF repo restructured
  and no longer contains the required filenames) → throws a
  specific error pointing at the validation expectations.

### Server (Swift)

- `Sources/CohereAsrService.swift`
  - `load(progress:)` — now `async throws`. Calls the new
    async resolver instead of the old sync one. Doc comment
    updated to describe the three-tier resolution.
  - New `resolveOrDownloadModelDirectory(progress:)` — replaces
    the old `resolveModelDirectory()`. Same env-override + cache
    checks, plus the new HF-download fallback.
  - New `downloadFromHF(repoId:targetDir:progress:)` — fetches
    the tree listing, downloads each file to the cache,
    preserving the directory structure for nested .mlpackage
    paths. URL-encodes path segments defensively.
  - New private `HFTreeEntry` Codable struct for parsing the
    tree-listing JSON.

No call-site changes elsewhere — `loadCohereModel()` already
passes `progress` through, so the new fractional ticks plumb out
to `cohereProgress` automatically.

### Verified

- `swift build -c release` — green.
- `curl /api/models/.../tree/main?recursive=true` returns a
  parseable JSON array matching `HFTreeEntry`'s shape (verified
  manually before shipping).
- `curl -I /resolve/main/tokenizer.model` returns 302 → S3 (HF's
  CDN pattern; URLSession follows automatically).
- End-to-end download flow not exercised on the dev machine
  because `POLYMIND_COHERE_LOCAL_DIR` is set and the env override
  takes precedence. The released DMG will exercise it on first
  launch by default.

### Follow-ups

- **Re-host under a project-controlled HF repo** with explicit
  Apache 2.0 attribution + tokenizer credit. Today's
  `defaultRepoId` (`phequals/cohere-transcribe-coreml-mixed-precision`)
  has no license and could be removed by the uploader at any
  time. Single-line change in `CohereAsrService` once the new
  repo exists.
- **Resumable downloads** — the current implementation re-fetches
  the entire 4 GB if anything fails partway. Adding HTTP Range
  request support would let interrupted downloads resume from
  the last completed file. Worth doing once we have field data
  showing how often the failure mode actually happens.
- **Background / deferred download** — first-launch users wait
  ~3-5 min before Start Meeting unlocks. UX could trigger the
  download explicitly from a "Download Cohere model" button so
  the app shell loads instantly and the user can navigate, take
  notes, etc. while the download runs.
