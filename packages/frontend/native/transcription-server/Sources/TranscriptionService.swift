import AVFoundation
import FluidAudio
import Foundation

/// File-based transcription service. No live pipeline; nothing runs
/// during the meeting. The native recorder writes the .m4a file
/// independently; when the user clicks Transcribe after End, we run
/// Cohere Transcribe 2B on the whole file end-to-end and return the
/// transcript as one segment.
///
/// Phase-8d/e: Whisper-large-v3 has been removed entirely. Cohere is
/// the only post-stop engine; the service is hard-gated to macOS 15+
/// (MLState requirement). Older macOS hits an empty transcript with
/// a clear log line — no silent fallback.
///
/// The server-side call blocks until Cohere has processed the entire
/// audio — there's no early-return and no truncation. A 10-minute
/// recording reliably produces a transcript covering all 10 minutes.
@MainActor
class TranscriptionService {

  /// Mic-repair configuration. Number of leading-silence samples to
  /// prepend on the second-pass Cohere call when the first pass
  /// yields suspiciously sparse text. 2 s × 16 kHz = 32 000 samples.
  /// Shifts the mel-frame boundary so the deterministic greedy
  /// decoder follows a different path on the second attempt.
  private static let repairPadSamples = 16_000 * 2

  /// Pre-loaded Parakeet-TDT models for the live draft transcript
  /// (Phase-7 replacement for Whisper-tiny). FluidAudio's
  /// `AsrModels` is `Sendable` so we load it once at startup and
  /// hand it to each new `LiveTranscriptionPipeline` instance.
  /// The pipeline creates a fresh `SlidingWindowAsrManager` per
  /// meeting using these pre-loaded models — no re-download,
  /// no re-compile of the CoreML kernels per meeting.
  ///
  /// ~250 MB, runs ~30× realtime on the Apple Neural Engine.
  /// Streaming-native — produces hypothesis updates ~1 Hz with
  /// stable confirmation after ~10 s of context. Replaced by the
  /// Cohere Transcribe 2B pass after stop (Phase-8d/e). English-
  /// only (was the trade-off for the quality + speed jump from
  /// Whisper-tiny in Phase 7).
  private var liveAsrModels: AsrModels?

  /// Acoustic echo cancellation. Runs on the mic stream of dual-
  /// track recordings before transcription, using the system stream
  /// as the far-end reference. Phase-6.5 addition: removes speaker
  /// bleed when the user records on laptop speakers instead of
  /// headphones, eliminating duplicate transcripts of remote speech.
  /// Still actively used by the Cohere path.
  private let aecService = MeetingNeuralAec()

  /// Cohere Transcribe 2B — the post-stop transcription engine
  /// (Phase-8d/e: Whisper-large-v3 has been removed; Cohere is now
  /// the only option). Hard-gated to macOS 15+ via the binary's
  /// platform requirement, so on supported builds this is always
  /// loaded after `loadCohereModel()`.
  ///
  /// Type-erased to `AnyObject?` to dodge an unconditional
  /// `@available(macOS 15, *)` reference at this declaration site.
  /// The class itself is `@available`-gated.
  private var cohereService: AnyObject?  // CohereAsrService, type-erased to dodge @available class refs

  /// Thread-safe state accessible from any queue (including HTTP server)
  /// without needing MainActor — important because CoreML compilation can
  /// block the main thread during the first load.
  let downloadState = ModelDownloadState()

  var isLiveModelLoaded: Bool { downloadState.read().liveLoaded }
  var isAecModelLoaded: Bool { downloadState.read().aecLoaded }
  var isCohereModelLoaded: Bool { downloadState.read().cohereLoaded }

  /// Direct accessor used by `MeetingCoordinator` to construct
  /// per-meeting `LiveTranscriptionPipeline` instances. Returns
  /// nil when the models haven't loaded yet (load failure or
  /// pre-load not yet completed).
  var liveModels: AsrModels? { liveAsrModels }

  /// Direct accessor for the live pipeline so it can run AEC
  /// frame-by-frame (Phase-7.5). Returns the service whether or
  /// not it loaded successfully — pipelines check `.isLoaded`
  /// before using it. Held by reference; the pipeline must not
  /// outlive `TranscriptionService` (it doesn't — pipelines are
  /// per-meeting and the service is a singleton).
  var aec: MeetingNeuralAec { aecService }

  init() {
    // Clean up orphaned model directories from previous app
    // versions. Phase-8d/e: now also removes Whisper-large-v3
    // (replaced by Cohere Transcribe 2B) in addition to the
    // pre-existing Whisper-tiny / -small / -medium orphans from
    // earlier development iterations. Idempotent — runs once
    // on first launch after upgrade, then no-ops forever.
    StaleModelCleanup.run()
  }

  // MARK: - Model loading

  /// Loads Parakeet-TDT for the live draft pipeline (Phase-7
  /// replacement for Whisper-tiny). Downloads via FluidAudio's
  /// `AsrModels.downloadAndLoad` — the manifest fetches multiple
  /// CoreML mlpackages (encoder + decoder + joint) totalling
  /// ~250 MB from `FluidInference/parakeet-tdt-0.6b-v3-coreml`.
  ///
  /// Models load once at startup; each `LiveTranscriptionPipeline`
  /// instance later creates its own `SlidingWindowAsrManager` and
  /// reuses these pre-loaded models without re-compiling the
  /// CoreML kernels. That's why the load function ends here at
  /// "models loaded" without a manager-level warmup — the manager
  /// handles its own kernel compile on first
  /// `startStreaming` / `streamAudio`, and the pipeline does that
  /// per meeting anyway.
  ///
  /// Failures are non-fatal at the service level — `liveLoaded`
  /// flips to true even on error so the UI doesn't block. If the
  /// live model failed to load, `liveAsrModels` stays nil and
  /// `MeetingCoordinator.startMeeting()` skips spinning up the
  /// live pipeline (recording still works; user just sees no live
  /// drafts in the sidebar). The post-stop Cohere pass still
  /// produces the final transcript.
  ///
  /// Idempotent — calling repeatedly is a no-op once loaded.
  func loadLiveModel() async throws {
    let state = downloadState
    guard !state.read().liveLoaded else { return }
    NSLog("[TranscriptionService] Loading live model (Parakeet-TDT)")
    state.update { $0.currentlyDownloading = "parakeet" }

    do {
      // FluidAudio downloads to its default cache dir under
      // ~/Library/Caches/FluidInference/parakeet-tdt-0.6b-v3-coreml/
      // unless we pass a different `to:` URL. Default is fine —
      // user can clear FluidAudio caches in one place if they
      // need to reclaim disk.
      let models = try await AsrModels.downloadAndLoad(
        progressHandler: { progress in
          state.update {
            $0.liveProgress = Float(progress.fractionCompleted)
          }
        }
      )
      liveAsrModels = models
      state.update {
        $0.liveProgress = 1.0
        $0.currentlyDownloading = nil
      }
    } catch {
      NSLog(
        "[TranscriptionService] Live model load failed (non-fatal): %@",
        error.localizedDescription
      )
      state.update {
        $0.liveProgress = 1.0
        $0.currentlyDownloading = nil
      }
    }

    state.update { $0.liveLoaded = true }
    NSLog("[TranscriptionService] Live model loaded")
  }

  /// Load DTLN-aec for the post-stop echo-cancellation pass.
  /// ~40 MB model, bundled with the package — no download. Same
  /// non-fatal pattern as the others: on failure we still flip
  /// `aecLoaded = true` so the UI doesn't block; the AEC step in
  /// `transcribeEntireFile` checks `aecService.isLoaded` and
  /// degrades to passthrough (raw mic) when not ready.
  ///
  /// Idempotent — safe to call repeatedly.
  func loadAecModel() async throws {
    let state = downloadState
    guard !state.read().aecLoaded else { return }
    NSLog("[TranscriptionService] Loading AEC model")
    state.update { $0.currentlyDownloading = "aec" }
    do {
      try await aecService.load()
      await aecService.warmup()
      state.update {
        $0.aecProgress = 1.0
        $0.currentlyDownloading = nil
      }
    } catch {
      NSLog(
        "[TranscriptionService] AEC load failed (non-fatal): %@",
        error.localizedDescription
      )
      state.update {
        $0.aecProgress = 1.0
        $0.currentlyDownloading = nil
      }
    }
    state.update { $0.aecLoaded = true }
    NSLog("[TranscriptionService] AEC model loaded")
  }

  /// Load Cohere Transcribe 2B — Phase-8b primary post-stop engine.
  /// Called from `MeetingCoordinator.loadModels()` AFTER the five
  /// existing models so the `modelsLoaded` gate (VAD + tiny + large
  /// + diariser + AEC) keeps its existing timeline. Also called
  /// lazily from `transcribeFile` as a safety net when the eager
  /// load was skipped or failed.
  ///
  /// Idempotent. macOS 14.x falls through silently (CohereAsrService
  /// is gated to macOS 15+ due to MLState). Local-dir override
  /// (`POLYMIND_COHERE_LOCAL_DIR` env) is the only supported model
  /// source until the production HF repo URL is finalised.
  ///
  /// On any failure, leaves `cohereLoaded = false` so the caller
  /// transparently falls back to Whisper. Errors are logged but
  /// not thrown — a failed Cohere load shouldn't block a
  /// transcribe; the user gets the existing Whisper output.
  func loadCohereModel() async {
    let s = downloadState
    guard !s.read().cohereLoaded else { return }

    guard #available(macOS 15, *) else {
      NSLog(
        "[TranscriptionService] Cohere skip: macOS 15+ required for MLState"
      )
      return
    }

    NSLog("[TranscriptionService] Loading Cohere Transcribe 2B")
    s.update { $0.currentlyDownloading = "cohere" }

    let service = CohereAsrService()
    do {
      try await service.load(progress: { p in
        s.update { $0.cohereProgress = Float(p) }
      })
      cohereService = service
      s.update {
        $0.cohereProgress = 1.0
        $0.currentlyDownloading = nil
        $0.cohereLoaded = true
      }
      NSLog("[TranscriptionService] Cohere model loaded")
    } catch {
      NSLog(
        "[TranscriptionService] Cohere load failed (non-fatal, fallback to Whisper): %@",
        error.localizedDescription
      )
      s.update {
        $0.cohereProgress = 0
        $0.currentlyDownloading = nil
      }
    }
  }

  // MARK: - Full-file transcription

  /// Run Cohere Transcribe 2B on the entire audio file end-to-end and
  /// return the transcript as a single segment.
  ///
  /// Phase-8d/e collapsed this to one engine. Whisper-large-v3 has
  /// been removed; macOS 14.x is no longer supported (Cohere requires
  /// MLState which is macOS 15+ only).
  ///
  /// Pipeline:
  ///   1. Decode the source file to mono Float32 PCM at 16 kHz.
  ///   2. Optional AEC pass on the mic stream of dual-track meetings
  ///      (uses the system stream as the far-end reference).
  ///   3. Cohere inference via `CohereAsrService` — sliding-window
  ///      chunks (35 s / 5 s overlap) with trigram-anchored merge.
  ///   4. Apply the user's cleanup chain (artifact filter / filler /
  ///      custom vocab) to the merged transcript.
  ///   5. Wrap the resulting text in one `TranscriptSegment` covering
  ///      [0, totalDuration] tagged with the caller's `speaker` label
  ///      so dual-track recordings still produce "You" / "Speaker"
  ///      bubbles.
  ///
  /// Returns an empty array when:
  ///   - decode fails,
  ///   - Cohere isn't loaded (load failure / older macOS),
  ///   - Cohere returns empty text,
  ///   - the cleanup chain filters everything away.
  ///
  /// Note: `diarise` is currently ignored. Cohere produces a single
  /// segment that diarisation has nothing to attach to. Kept on the
  /// signature for back-compat; future work could re-introduce per-
  /// chunk segments + diarised speaker labels (see Phase 8 follow-ups
  /// in the build log).
  func transcribeEntireFile(
    audioPath: String,
    speaker: String? = nil,
    diarise: Bool = true,
    removeFillers: Bool = false,
    customVocabulary: [CustomWordEntry] = [],
    aecReferencePath: String? = nil,
    applyAec: Bool = true,
    onProgress: ((TranscriptSegment) -> Void)? = nil
  ) async -> [TranscriptSegment] {
    _ = diarise  // intentionally unused — see doc comment above
    NSLog(
      "[TranscriptionService] transcribeEntireFile (Cohere): %@",
      audioPath
    )
    let startTime = Date()

    // Decode the source file to mono Float32 PCM at 16 kHz, the
    // sample rate Whisper and Silero VAD both expect. AVAudioFile
    // handles m4a, opus, wav, mp3 — anything AVAsset can read.
    guard var pcm = decodeAudioFileToPCM(audioPath) else {
      NSLog(
        "[TranscriptionService] transcribeEntireFile: decode failed for %@",
        audioPath
      )
      return []
    }
    let sampleRate = 16_000
    NSLog(
      "[TranscriptionService] decoded %d samples (%.1fs)",
      pcm.count, Double(pcm.count) / Double(sampleRate)
    )

    // Acoustic echo cancellation pass (Phase-6.5). Runs ONLY when:
    //   - caller hasn't opted out via applyAec=false
    //   - the AEC model is actually loaded (load failure → skip)
    //   - a reference path was supplied (single-track recordings
    //     have nothing to reference against, so AEC is a no-op
    //     for them — caller passes nil and we skip)
    //
    // Replaces `pcm` in-place with the cleaned mic signal so all
    // downstream stages (VAD, Whisper, diariser) see the de-echoed
    // audio. Cleaned PCM has the same length as the original; if
    // AEC fails partway, mic passes through unchanged.
    if applyAec, aecService.isLoaded, let refPath = aecReferencePath {
      if let referencePCM = decodeAudioFileToPCM(refPath) {
        let aecStart = Date()
        let cleaned = aecService.process(mic: pcm, reference: referencePCM)
        if cleaned.count == pcm.count {
          pcm = cleaned
          NSLog(
            "[TranscriptionService] AEC applied in %.1fs (mic %d → %d samples)",
            Date().timeIntervalSince(aecStart),
            pcm.count, cleaned.count
          )
        } else {
          // Defensive: if the AEC pass somehow returned a different
          // length (model bug or our framing logic error), don't
          // use it — would corrupt timestamps. Pass-through.
          NSLog(
            "[TranscriptionService] AEC returned %d samples (expected %d) — falling back to raw mic",
            cleaned.count, pcm.count
          )
        }
      } else {
        NSLog(
          "[TranscriptionService] AEC reference decode failed for %@ — falling back to raw mic",
          refPath
        )
      }
    }
    let totalSamples = pcm.count

    // Cohere transcribe — the only post-stop engine post-Phase-8d/e.
    // The macOS 15+ guard is an absolute fence: the binary's platform
    // requirement bumped to macOS 15 in Phase 8d/e, so this guard
    // should always succeed in production. Kept defensive for the
    // `swift build` path where SDK version may differ from the
    // deployment platform.
    guard #available(macOS 15, *),
          let cohere = cohereService as? CohereAsrService,
          cohere.isLoaded
    else {
      NSLog(
        "[TranscriptionService] Cohere not available — returning empty (macOS 15+ required)"
      )
      return []
    }

    let cohereStart = Date()
    let primary = await cohere.transcribe(samples: pcm)
    let cohereElapsed = Date().timeIntervalSince(cohereStart)

    // Mic repair pass. Cohere's decoder is a deterministic greedy
    // argmax, so re-running on the exact same input produces the
    // exact same output — useless for repair. Instead, when the
    // primary pass yields suspiciously sparse text we shift the
    // mel-frame boundary by prepending 2 s of silence, which gives
    // the encoder a different framing (different mel windows →
    // different attention pattern) and therefore a potentially
    // different decoder path. We pick the longer of the two
    // outputs as the final result. Length is a coarse proxy for
    // completeness, but it's the only signal we have without
    // ground truth, and a longer output is rarely worse than an
    // empty one.
    //
    // Triggers only when:
    //   - primary is empty, OR
    //   - audio is > 5 s AND char-density < 5 chars/sec
    //
    // Healthy speech runs ~12-15 chars/sec including spaces; the
    // 5-chars/sec floor catches obvious decoder collapses (silence
    // hallucinations, noSpeech rejections, mid-decode aborts) without
    // re-running on every short utterance. The repair pass costs an
    // extra ~2 s of inference per minute of audio when it fires,
    // so keeping the trigger tight matters.
    let audioSeconds = Double(totalSamples) / Double(sampleRate)
    let primaryDensity = audioSeconds > 0
      ? Double(primary.count) / audioSeconds
      : 0
    let needsRepair = primary.isEmpty
      || (audioSeconds > 5.0 && primaryDensity < 5.0)

    var rawTranscript = primary
    if needsRepair {
      NSLog(
        "[TranscriptionService] mic repair: primary %.1f chars/sec on %.1fs — retrying with shifted framing",
        primaryDensity, audioSeconds
      )
      let repairStart = Date()
      // 2 s of leading silence shifts the chunk window by 32 000
      // samples. Cohere's chunker re-splits from the new origin so
      // every chunk's mel windows are differently aligned. Cheap
      // way to vary the deterministic path.
      var padded = [Float](repeating: 0.0, count: Self.repairPadSamples)
      padded.append(contentsOf: pcm)
      let secondary = await cohere.transcribe(samples: padded)
      let repairElapsed = Date().timeIntervalSince(repairStart)
      if secondary.count > primary.count {
        rawTranscript = secondary
        NSLog(
          "[TranscriptionService] mic repair: secondary kept (%d chars vs primary %d) in %.1fs",
          secondary.count, primary.count, repairElapsed
        )
      } else {
        NSLog(
          "[TranscriptionService] mic repair: primary kept (%d chars vs secondary %d) in %.1fs",
          primary.count, secondary.count, repairElapsed
        )
      }
    }

    if rawTranscript.isEmpty {
      NSLog(
        "[TranscriptionService] Cohere returned empty in %.1fs (after repair)",
        cohereElapsed
      )
      return []
    }

    // Cleanup chain — same toggles the Whisper path used:
    //   1. TranscriptArtifactFilter: drop full-text
    //      [BLANK_AUDIO] / prompt-regurgitation leakage.
    //   2. FillerWordFilter (if enabled): remove "uh" / "um" / etc.
    //   3. CustomWordMatcher (if vocab provided): fuzzy-replace
    //      misheard terms with user's preferred spellings.
    // sanitizeWhisperText is intentionally skipped — Cohere's
    // tokenizer doesn't emit Whisper-style <|...|> special tokens.
    var text = TranscriptArtifactFilter.apply(rawTranscript)
    if removeFillers { text = FillerWordFilter.apply(text) }
    if !customVocabulary.isEmpty {
      text = CustomWordMatcher.apply(text, entries: customVocabulary)
    }
    if text.isEmpty {
      NSLog("[TranscriptionService] cleanup chain emptied transcript")
      return []
    }

    let totalDuration = Double(totalSamples) / Double(sampleRate)
    let segment = TranscriptSegment(
      start: formatTime(0),
      end: formatTime(totalDuration),
      text: text,
      quality: "final",
      // Caller-supplied speaker label ("You" for dual-track mic,
      // "Speaker" for dual-track system, nil for single-track).
      // No diarised override here — Cohere's single-segment output
      // gives diarisation nothing to attach to.
      speaker: speaker
    )
    onProgress?(segment)

    let totalElapsed = Date().timeIntervalSince(startTime)
    NSLog(
      "[TranscriptionService] transcribeEntireFile done in %.1fs (Cohere %.1fs) — %d chars",
      totalElapsed, cohereElapsed, text.count
    )
    return [segment]
  }

  // Phase-8r: `transcribeEntireFileParakeet` removed. Post-stop
  // transcription is Cohere-only. Parakeet is now reserved for the
  // live streaming path during the meeting (one stream per channel
  // for "You" / "Speaker" attribution as audio arrives) — see
  // `LiveTranscriptionPipeline`. The live model loader
  // (`loadLiveModel()`) is still called at startup so live streaming
  // is ready when the meeting begins.

  // MARK: - Audio decoding

  /// Decode an audio file (m4a / opus / wav / mp3 — anything AVAsset
  /// can read) to mono Float32 PCM samples at 16 kHz. Returns nil if
  /// the file can't be opened or decoded. Implementation uses
  /// AVAudioFile + AVAudioConverter to do the format conversion in
  /// one pass; we never materialise the full file at the source rate.
  private nonisolated func decodeAudioFileToPCM(_ audioPath: String) -> [Float]? {
    let url = URL(fileURLWithPath: audioPath)

    // We previously used AVAudioFile here. AVAudioFile.read() throws an
    // opaque `Foundation._GenericObjCError` from this server context
    // even on files that read fine from a standalone Swift process —
    // suspected interaction with the loaded CoreML models / actor
    // executors on macOS 26.4 SDK. AVAssetReader uses a different
    // decode path internally and works in the same context, so we
    // route through it instead. Same supported formats (anything
    // AVAsset can read: m4a / mp3 / wav / opus / etc.).
    let asset = AVURLAsset(url: url)
    guard let track = asset.tracks(withMediaType: .audio).first else {
      NSLog(
        "[TranscriptionService] AVAsset has no audio track: %@",
        audioPath
      )
      return nil
    }

    // Output settings: 16 kHz mono Float32, non-interleaved (single
    // channel = no interleaving distinction, but explicitly Float
    // & native byte order).
    let outputSettings: [String: Any] = [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVSampleRateKey: 16_000,
      AVNumberOfChannelsKey: 1,
      AVLinearPCMBitDepthKey: 32,
      AVLinearPCMIsFloatKey: true,
      AVLinearPCMIsBigEndianKey: false,
      AVLinearPCMIsNonInterleaved: false,
    ]

    let reader: AVAssetReader
    do {
      reader = try AVAssetReader(asset: asset)
    } catch {
      NSLog(
        "[TranscriptionService] AVAssetReader init failed: %@",
        error.localizedDescription
      )
      return nil
    }
    let trackOutput = AVAssetReaderTrackOutput(
      track: track,
      outputSettings: outputSettings
    )
    trackOutput.alwaysCopiesSampleData = false
    guard reader.canAdd(trackOutput) else {
      NSLog("[TranscriptionService] AVAssetReader can't add audio output")
      return nil
    }
    reader.add(trackOutput)

    guard reader.startReading() else {
      NSLog(
        "[TranscriptionService] AVAssetReader.startReading failed: %@",
        reader.error?.localizedDescription ?? "unknown"
      )
      return nil
    }

    // Roughly size the output. Reader doesn't expose total sample
    // count up front; estimate from the asset duration. Worst case
    // we over-allocate a bit on long meetings, which is fine.
    let estimatedSamples = Int(
      CMTimeGetSeconds(asset.duration) * 16_000.0
    )
    var output: [Float] = []
    output.reserveCapacity(max(estimatedSamples, 16_000))

    while reader.status == .reading {
      guard let buffer = trackOutput.copyNextSampleBuffer() else { break }
      guard let blockBuffer = CMSampleBufferGetDataBuffer(buffer) else {
        continue
      }

      let length = CMBlockBufferGetDataLength(blockBuffer)
      // 4 bytes per Float32 sample (mono, so frames == samples).
      let sampleCount = length / 4
      if sampleCount == 0 { continue }

      var bytes = [UInt8](repeating: 0, count: length)
      let copyStatus = bytes.withUnsafeMutableBytes { ptr -> OSStatus in
        guard let base = ptr.baseAddress else { return -1 }
        return CMBlockBufferCopyDataBytes(
          blockBuffer,
          atOffset: 0,
          dataLength: length,
          destination: base
        )
      }
      if copyStatus != 0 {
        NSLog(
          "[TranscriptionService] CMBlockBufferCopyDataBytes failed: %d",
          copyStatus
        )
        continue
      }

      bytes.withUnsafeBytes { raw in
        let floats = raw.bindMemory(to: Float.self)
        output.append(contentsOf: UnsafeBufferPointer(
          start: floats.baseAddress,
          count: sampleCount
        ))
      }
    }

    if reader.status == .failed {
      NSLog(
        "[TranscriptionService] AVAssetReader failed mid-read: %@",
        reader.error?.localizedDescription ?? "unknown"
      )
      // Return whatever we got — partial transcript better than nothing
      // for a long meeting where the reader fails on the last second.
    }
    return output
  }
}
