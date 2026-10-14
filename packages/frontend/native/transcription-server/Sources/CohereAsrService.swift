import Accelerate
@preconcurrency import CoreML
import Foundation

/// Cohere Transcribe 2B inference service (Phase-8 alternative
/// post-stop engine).
///
/// Ported from Muesli's `CohereTranscribeBackend.swift` and adapted
/// to PolyMind's existing service patterns:
///   - `@MainActor` isolation matching `TranscriptionService`,
///     `DiarizationService`, etc.
///   - `NSLog` logging with `[CohereAsrService]` prefix.
///   - Local-files-first model resolution: env var override
///     `POLYMIND_COHERE_LOCAL_DIR` points at a directory of
///     pre-downloaded `.mlpackage`s. Used during Phase-8a smoke
///     testing — set to `~/Desktop/cohere-transcribe-coreml/` and
///     the service reads from there. Production rollout will
///     re-host phequals' files under a project-controlled HF repo
///     with explicit Apache 2.0 attribution.
///
/// Three CoreML packages run inference:
///   - `cohere_encoder_dynamic.mlpackage` — encoder
///   - `cohere_decoder_prefill_int8.mlpackage` — prefill stage,
///     int8 quantized
///   - `cohere_decoder_decode_int8.mlpackage` — autoregressive
///     decode stage, int8, shares MLState (KV cache) with prefill
///
/// Plus support files:
///   - `tokenizer.model` — SentencePiece protobuf
///   - `cohere_mel_filterbank.bin` — librosa Slaney filterbank
///     (128 mels × 257 freq bins, fp32)
///   - `cohere_mel_window.bin` — torch Hann window
///     (winLength=400, fp32)
///
/// Failure semantics: non-fatal at the service level. If load
/// fails, `isLoaded` stays false and `transcribe(_:)` returns
/// empty. Caller (`TranscriptionService.transcribeEntireFile`)
/// falls back to Whisper-large-v3 when Cohere isn't ready.
///
/// macOS 15+ only — MLState (the KV-cache mechanism the prefill
/// and decode decoders share) is a Core ML 8 API. Older OS
/// versions hit the existing Whisper path; Cohere is hard-gated
/// at the service-construction site (`TranscriptionService`)
/// so we never instantiate this class on unsupported systems.
@available(macOS 15, *)
@MainActor
final class CohereAsrService {
  // MARK: - Configuration

  /// Default HF repo for the CoreML port. Phase-8 ships pointing
  /// at phequals' upload (no license stated; safe to use as a
  /// derivative of the upstream Apache 2.0 model). Will swap to a
  /// project-controlled repo before commercial release. Single
  /// constant intentionally — one-line change later.
  private static let defaultRepoId = "phequals/cohere-transcribe-coreml-mixed-precision"

  /// Env override for development / smoke testing. Set this to a
  /// directory containing the downloaded files and the service
  /// loads from there instead of fetching from HF. Used during
  /// Phase-8a integration before the production repo URL is set.
  private static let localDirEnvKey = "POLYMIND_COHERE_LOCAL_DIR"

  /// Required model packages (the three CoreML model files).
  private static let modelPackages = [
    "cohere_encoder_dynamic.mlpackage",
    "cohere_decoder_prefill_int8.mlpackage",
    "cohere_decoder_decode_int8.mlpackage",
  ]

  /// Required auxiliary files (tokenizer + mel feature extraction
  /// constants) alongside the .mlpackages.
  private static let auxFiles = [
    "tokenizer.model",
    "cohere_mel_filterbank.bin",
    "cohere_mel_window.bin",
  ]

  // Mel spectrogram parameters — must match Cohere's training
  // pipeline exactly. Numbers from the Cohere model card / NeMo
  // FilterbankFeatures spec.
  private static let sampleRate = 16_000
  private static let nFFT = 512
  private static let hopLength = 160
  private static let nMels = 128
  private static let winLength = 400 // 0.025 * 16000
  private static let melLength = 3500
  private static let encLen = 438

  // Token IDs in the prompt prefix. These steer the model to
  // produce a clean transcript (no timestamps, no diarization,
  // standard punctuation, no inverse-text-normalization).
  private static let promptPrefixTokenId: Int32 = 13764
  private static let startOfContextTokenId: Int32 = 7
  private static let startOfTranscriptTokenId: Int32 = 4
  private static let undefinedEmotionTokenId: Int32 = 16
  private static let punctuationTokenId: Int32 = 5
  private static let noInverseTextNormalizationTokenId: Int32 = 9
  private static let noTimestampTokenId: Int32 = 11
  private static let noDiarizationTokenId: Int32 = 13

  // Decoder constants.
  private static let maxSeqLen = 512
  private static let vocabSize = 16_384
  private static let eosTokenId = 3 // <|endoftext|>

  // Audio chunking (sliding window over long meetings).
  private static let maxAudioSamples = 35 * 16_000
  private static let chunkOverlapSamples = 5 * 16_000

  /// English-only for now. The model supports 14 languages (per
  /// Cohere model card) but PolyMind's UI is English; matching
  /// our existing Whisper config (`language: "en"`).
  private static let englishPromptTokenId: Int32 = 62

  /// Build the full prompt token sequence for English transcription.
  private static func englishPromptIds() -> [Int32] {
    [
      promptPrefixTokenId,
      startOfContextTokenId,
      startOfTranscriptTokenId,
      undefinedEmotionTokenId,
      englishPromptTokenId,
      englishPromptTokenId,
      punctuationTokenId,
      noInverseTextNormalizationTokenId,
      noTimestampTokenId,
      noDiarizationTokenId,
    ]
  }

  // MARK: - State

  private var models: CohereModels?

  /// Cached masks reused across decode loop iterations (one per
  /// position within `maxSeqLen`). Built lazily on first use.
  /// Cleared on `unload()`.
  private var updateMaskCache: [Int: MLMultiArray] = [:]
  private var validMaskCache: [Int: MLMultiArray] = [:]

  var isLoaded: Bool { models != nil }

  // MARK: - Public API

  /// Load all three CoreML models + tokenizer + mel filterbank
  /// into memory. Idempotent. Throws on download failure, file-not-
  /// found, model compile failure, or tokenizer parse error.
  ///
  /// `progress` is called with a 0-1 fraction. We reserve 0-0.95 for
  /// the HuggingFace download (the slow part on first launch — ~4 GB)
  /// and snap to 1.0 once CoreML compile + load completes. On
  /// subsequent launches the cache is hit and progress only ticks
  /// once at the end.
  ///
  /// Resolution order (Phase 8c):
  ///   1. `POLYMIND_COHERE_LOCAL_DIR` env override (dev-only)
  ///   2. `~/Library/Application Support/PolyMind/cohere-transcribe-coreml/`
  ///      cache hit
  ///   3. Auto-download from `defaultRepoId` on HuggingFace into
  ///      the cache, then load
  func load(progress: @Sendable (Double) -> Void = { _ in }) async throws {
    if models != nil { return }
    let directory = try await Self.resolveOrDownloadModelDirectory(
      progress: progress
    )
    NSLog("[CohereAsrService] loading from %@", directory.path)

    let start = Date()
    let loaded = try await CohereModels.load(from: directory)
    self.models = loaded
    progress(1.0)

    NSLog(
      "[CohereAsrService] loaded in %.2fs (encoder lengthAware=%@)",
      Date().timeIntervalSince(start),
      loaded.encoderUsesDynamicLength ? "true" : "false"
    )
  }

  /// Free CoreML models + caches. Call when retiring the service
  /// (e.g. server shutdown) to release ANE memory.
  func unload() {
    models = nil
    updateMaskCache.removeAll(keepingCapacity: false)
    validMaskCache.removeAll(keepingCapacity: false)
  }

  /// Run Cohere Transcribe 2B on the entire decoded mic buffer.
  /// Returns plain transcript text (no per-segment timing — see
  /// note below).
  ///
  /// **Why no segment timestamps.** The CoreML port runs decoding
  /// without word/segment timestamp tokens (the `noTimestampTokenId`
  /// in the prompt forces this). The output is one continuous
  /// transcript. Caller (`TranscriptionService`) wraps this in a
  /// single `TranscriptSegment` covering the full audio range,
  /// which is correct for Cohere's output shape but loses the
  /// fine-grained per-utterance timing Whisper produces.
  ///
  /// If we need per-segment timestamps for Cohere meetings, the
  /// fix is one of:
  ///   1. Switch the prompt to include timestamp tokens (Cohere
  ///      supports it — different `promptIds` set required).
  ///   2. Run a parallel VAD pass on the same audio to derive
  ///      segment boundaries, then split the transcript by char
  ///      proportion across them.
  /// Out of scope for Phase 8a.
  ///
  /// `samples` must be 16 kHz mono Float32 PCM. Returns empty
  /// string on inference failure (after logging) — caller can
  /// fall back to Whisper.
  func transcribe(samples: [Float]) async -> String {
    guard let models = models else {
      NSLog("[CohereAsrService] transcribe called before load — returning empty")
      return ""
    }

    let start = Date()
    let chunks = scheduleChunks(samples: samples)
    NSLog(
      "[CohereAsrService] transcribe %.1fs audio in %d chunk(s)",
      Double(samples.count) / Double(Self.sampleRate),
      chunks.count
    )

    var transcripts: [String] = []
    for (idx, chunkSamples) in chunks.enumerated() {
      do {
        let (chunkMel, realFrameCount) = computeMel(audio: chunkSamples, models: models)
        let chunkText = try transcribeChunk(
          mel: chunkMel,
          realMelFrames: realFrameCount,
          models: models
        )
        if !chunkText.isEmpty {
          transcripts.append(chunkText)
        }
      } catch {
        NSLog(
          "[CohereAsrService] chunk %d/%d failed (continuing): %@",
          idx + 1, chunks.count, error.localizedDescription
        )
      }
    }

    // Reconcile overlapping chunks via the same trigram-aware
    // merge we use for the dual-track post-stop pass.
    // `TranscriptOverlapMerge` handles 1-element input as a no-op.
    let merged = TranscriptOverlapMerge.merge(transcripts)
    let cleaned = Self.cleanTranscript(merged)
    NSLog(
      "[CohereAsrService] done in %.1fs (%d chars)",
      Date().timeIntervalSince(start),
      cleaned.count
    )
    return cleaned
  }

  // MARK: - Directory resolution

  /// Resolve the model directory or download from HuggingFace if
  /// it's missing. Phase 8c — replaces the manual-only resolver
  /// with a three-tier fallback:
  ///   1. `POLYMIND_COHERE_LOCAL_DIR` env override (dev-only;
  ///      lets us run against a pre-downloaded directory without
  ///      polluting Application Support).
  ///   2. `defaultCacheDirectory()` cache hit (every launch after
  ///      the first one).
  ///   3. `downloadFromHF()` into the cache, then load.
  ///
  /// `progress` ticks 0 → 0.95 during the HF download phase.
  /// Cached / env-override paths emit nothing here — they're fast
  /// enough that we let the calling `load()` snap to 1.0 once
  /// CoreML compile finishes.
  private static func resolveOrDownloadModelDirectory(
    progress: @Sendable (Double) -> Void
  ) async throws -> URL {
    if let raw = ProcessInfo.processInfo.environment[localDirEnvKey],
      !raw.isEmpty
    {
      let url = URL(fileURLWithPath: raw, isDirectory: true)
      if validateModelDirectory(url) {
        NSLog("[CohereAsrService] using env-override directory %@", url.path)
        return url
      }
      NSLog(
        "[CohereAsrService] env-override directory missing required files: %@",
        url.path
      )
    }

    let cache = defaultCacheDirectory()
    if validateModelDirectory(cache) {
      NSLog("[CohereAsrService] using cached directory %@", cache.path)
      return cache
    }

    // Cache miss — download.
    NSLog(
      "[CohereAsrService] cache miss, downloading %@ to %@",
      defaultRepoId, cache.path
    )
    try await downloadFromHF(
      repoId: defaultRepoId,
      targetDir: cache,
      progress: progress
    )

    guard validateModelDirectory(cache) else {
      throw NSError(
        domain: "CohereAsrService",
        code: 3,
        userInfo: [
          NSLocalizedDescriptionKey: """
          Cohere download from \(defaultRepoId) finished but the cache at \
          \(cache.path) failed post-download validation. The HF repo may have \
          changed structure or the download was incomplete. Required files: \
          \(modelPackages.joined(separator: ", ")), \
          \(auxFiles.joined(separator: ", ")).
          """
        ]
      )
    }
    NSLog("[CohereAsrService] download complete, using %@", cache.path)
    return cache
  }

  // MARK: - HuggingFace download

  /// One entry from the HF tree-listing API. We only download
  /// entries where `type == "file"` — directory entries are
  /// implicit (we create the parent tree when writing each file).
  private struct HFTreeEntry: Codable {
    let type: String
    let path: String
    let size: Int?
  }

  /// Fetch the entire repo tree from HuggingFace and stream each
  /// file into `targetDir`. Walks the same directory layout the
  /// repo has (`.mlpackage/Data/com.apple.CoreML/...` etc) so the
  /// CoreML loader sees the structure it expects.
  ///
  /// Best-effort atomicity: each file is downloaded to a system
  /// temp URL via `URLSession.download` and atomically moved into
  /// place. If we fail partway through, partial files remain in
  /// `targetDir` and the next launch's `validateModelDirectory`
  /// will flag the cache as incomplete and retry the whole download.
  ///
  /// No retry/backoff at this layer — a transient HF outage just
  /// surfaces as a load error and the user retries by relaunching.
  /// HF is reliable enough that adding retry machinery is premature.
  private static func downloadFromHF(
    repoId: String,
    targetDir: URL,
    progress: @Sendable (Double) -> Void
  ) async throws {
    guard
      let listURL = URL(
        string: "https://huggingface.co/api/models/\(repoId)/tree/main?recursive=true"
      )
    else {
      throw NSError(
        domain: "CohereAsrService",
        code: 4,
        userInfo: [
          NSLocalizedDescriptionKey: "Could not build HF tree URL for \(repoId)"
        ]
      )
    }

    NSLog("[CohereAsrService] fetching HF tree: %@", listURL.absoluteString)
    let (listData, listResponse) = try await URLSession.shared.data(from: listURL)
    if let http = listResponse as? HTTPURLResponse, http.statusCode != 200 {
      throw NSError(
        domain: "CohereAsrService",
        code: http.statusCode,
        userInfo: [
          NSLocalizedDescriptionKey: """
          HF tree API returned HTTP \(http.statusCode) for \(repoId). \
          The repo may be private, gated, or the URL is wrong.
          """
        ]
      )
    }

    let entries = try JSONDecoder().decode([HFTreeEntry].self, from: listData)
    let files = entries.filter { $0.type == "file" }
    let totalBytes = files.reduce(Int64(0)) { $0 + Int64($1.size ?? 0) }

    NSLog(
      "[CohereAsrService] HF tree: %d files, %.1f MB total",
      files.count,
      Double(totalBytes) / 1_000_000.0
    )

    let fm = FileManager.default
    try fm.createDirectory(at: targetDir, withIntermediateDirectories: true)

    var downloadedBytes: Int64 = 0
    for (idx, entry) in files.enumerated() {
      // Path-encode each segment so spaces / unicode in HF paths
      // don't break the URL. Most repos stick to ASCII but we
      // shouldn't depend on that.
      let encodedPath =
        entry.path
        .split(separator: "/")
        .map { segment in
          String(segment).addingPercentEncoding(
            withAllowedCharacters: .urlPathAllowed
          ) ?? String(segment)
        }
        .joined(separator: "/")

      guard
        let fileURL = URL(
          string: "https://huggingface.co/\(repoId)/resolve/main/\(encodedPath)"
        )
      else {
        throw NSError(
          domain: "CohereAsrService",
          code: 5,
          userInfo: [
            NSLocalizedDescriptionKey:
              "Invalid HF download URL for \(entry.path)"
          ]
        )
      }
      let destURL = targetDir.appendingPathComponent(entry.path)

      // Mirror the directory tree from the repo (handles nested
      // .mlpackage/Data/com.apple.CoreML/... paths).
      try fm.createDirectory(
        at: destURL.deletingLastPathComponent(),
        withIntermediateDirectories: true
      )

      let (tempURL, fileResponse) = try await URLSession.shared.download(
        from: fileURL
      )
      if let http = fileResponse as? HTTPURLResponse, http.statusCode != 200 {
        throw NSError(
          domain: "CohereAsrService",
          code: http.statusCode,
          userInfo: [
            NSLocalizedDescriptionKey:
              "HF download of \(entry.path) returned HTTP \(http.statusCode)"
          ]
        )
      }

      if fm.fileExists(atPath: destURL.path) {
        try fm.removeItem(at: destURL)
      }
      try fm.moveItem(at: tempURL, to: destURL)

      downloadedBytes += Int64(entry.size ?? 0)
      let fraction =
        totalBytes > 0
        ? Double(downloadedBytes) / Double(totalBytes)
        : Double(idx + 1) / Double(files.count)
      // Reserve the last 5% for the post-download CoreML compile —
      // load() snaps to 1.0 once the model is fully compiled.
      progress(min(0.95, fraction * 0.95))
    }

    NSLog(
      "[CohereAsrService] HF download done: %d files, %.1f MB",
      files.count,
      Double(downloadedBytes) / 1_000_000.0
    )
  }

  /// Default cache directory. Mirrors our other model caches under
  /// Application Support. Phase-8c added auto-download from HF on
  /// cache miss; pre-8c builds expected the user to populate this
  /// manually via the env override.
  private static func defaultCacheDirectory() -> URL {
    let base =
      FileManager.default.urls(
        for: .applicationSupportDirectory,
        in: .userDomainMask
      ).first ?? FileManager.default.temporaryDirectory
    return base.appending(path: "PolyMind/cohere-transcribe-coreml")
  }

  /// Check that `directory` contains every required file. Accepts
  /// either the raw `.mlpackage` directories or the post-compile
  /// `.mlmodelc` outputs (whichever the loader has produced).
  private static func validateModelDirectory(_ directory: URL) -> Bool {
    let fm = FileManager.default
    let modelsPresent = modelPackages.allSatisfy { packageName in
      let packageURL = directory.appending(path: packageName)
      let compiledURL = directory.appending(
        path: packageName.replacingOccurrences(
          of: ".mlpackage",
          with: ".mlmodelc"
        )
      )
      let compiledData = compiledURL.appending(path: "coremldata.bin")
      return fm.fileExists(atPath: packageURL.path)
        || fm.fileExists(atPath: compiledData.path)
    }
    guard modelsPresent else { return false }
    return auxFiles.allSatisfy { name in
      fm.fileExists(atPath: directory.appending(path: name).path)
    }
  }

  // MARK: - Inference: per-chunk

  private func transcribeChunk(
    mel: [Float],
    realMelFrames: Int,
    models: CohereModels
  ) throws -> String {
    let nMels = Self.nMels
    let melLength = Self.melLength
    let encLen = Self.encLen
    let promptIds = Self.englishPromptIds()
    let promptLength = promptIds.count

    // Encoder input: mel [1, 128, 3500].
    let melArray = try MLMultiArray(
      shape: [1, NSNumber(value: nMels), NSNumber(value: melLength)],
      dataType: .float32
    )
    let melPtr = melArray.dataPointer.bindMemory(
      to: Float.self,
      capacity: nMels * melLength
    )
    _ = mel.withUnsafeBufferPointer { src in
      memcpy(melPtr, src.baseAddress!, nMels * melLength * MemoryLayout<Float>.stride)
    }

    // Encoder mask [1, encLen]: 1.0 for real positions, 0.0 for padded.
    // Subsampling factor ≈ melLength/encLen = 3500/438 ≈ 8.
    let realEncPositions = min((realMelFrames + 7) / 8, encLen)
    let encoderMask = try MLMultiArray(
      shape: [1, NSNumber(value: encLen)],
      dataType: .float32
    )
    let maskPtr = encoderMask.dataPointer.bindMemory(
      to: Float.self,
      capacity: encLen
    )
    for i in 0..<encLen {
      maskPtr[i] = i < realEncPositions ? 1.0 : 0.0
    }

    // Encoder forward.
    var encInputs: [String: MLFeatureValue] = [
      "mel": MLFeatureValue(multiArray: melArray)
    ]
    if models.encoderUsesDynamicLength {
      let lengthArray = try MLMultiArray(shape: [1], dataType: .int32)
      lengthArray[0] = NSNumber(value: Int32(realMelFrames))
      encInputs["length"] = MLFeatureValue(multiArray: lengthArray)
    }
    let encInput = try MLDictionaryFeatureProvider(dictionary: encInputs)
    let encOutput = try models.encoder.prediction(from: encInput)
    guard
      let encoderHidden = encOutput.featureValue(for: "encoder_hidden")?
        .multiArrayValue
    else {
      throw NSError(
        domain: "CohereAsrService",
        code: 14,
        userInfo: [NSLocalizedDescriptionKey: "Missing encoder_hidden output"]
      )
    }

    // Prefill — fills the KV cache with the prompt + initial context.
    // The prefill and decode decoders share `state` (MLState) for
    // KV cache. Both models must export identical state specs;
    // mismatched specs silently corrupt KV values.
    let promptArray = try MLMultiArray(
      shape: [1, NSNumber(value: promptLength)],
      dataType: .int32
    )
    let promptPtr = promptArray.dataPointer.bindMemory(
      to: Int32.self,
      capacity: promptLength
    )
    for (i, id) in promptIds.enumerated() {
      promptPtr[i] = id
    }
    let state = models.prefillDecoder.makeState()
    let prefillInput = try MLDictionaryFeatureProvider(dictionary: [
      "encoder_hidden": MLFeatureValue(multiArray: encoderHidden),
      "input_ids": MLFeatureValue(multiArray: promptArray),
      "encoder_mask": MLFeatureValue(multiArray: encoderMask),
    ])
    let prefillOutput = try models.prefillDecoder.prediction(
      from: prefillInput,
      using: state
    )
    guard
      let prefillLogits = prefillOutput.featureValue(for: "logits")?
        .multiArrayValue
    else {
      throw NSError(
        domain: "CohereAsrService",
        code: 15,
        userInfo: [NSLocalizedDescriptionKey: "Missing logits from prefill"]
      )
    }

    var nextToken = argmaxLastPosition(logits: prefillLogits, seqLen: promptLength)
    var generatedIds: [Int] = []
    var currentPosition = promptLength

    // Decode loop. Token budget bounds runaway hallucination on
    // chunks where the encoder length-mask isn't enough on its own.
    let audioSeconds =
      Double(realMelFrames * Self.hopLength) / Double(Self.sampleRate)
    let tokenBudget = max(15, Int(audioSeconds * 7.0))
    let maxNewTokens = models.encoderUsesDynamicLength
      ? (Self.maxSeqLen - promptLength)
      : min(Self.maxSeqLen - promptLength, tokenBudget)

    let tokenIdArray = try MLMultiArray(shape: [1, 1], dataType: .int32)
    let tokenIdPtr = tokenIdArray.dataPointer.bindMemory(
      to: Int32.self,
      capacity: 1
    )

    var shouldStop = false
    for _ in 0..<maxNewTokens {
      if nextToken == Self.eosTokenId { break }
      generatedIds.append(nextToken)
      guard currentPosition < Self.maxSeqLen else { break }
      let updateMaskArr = try cachedUpdateMask(for: currentPosition)
      let validMaskArr = try cachedValidMask(for: currentPosition)

      try autoreleasepool {
        tokenIdPtr[0] = Int32(nextToken)
        let decodeInput = try MLDictionaryFeatureProvider(dictionary: [
          "input_ids": MLFeatureValue(multiArray: tokenIdArray),
          "cache_update_mask": MLFeatureValue(multiArray: updateMaskArr),
          "cache_valid_mask": MLFeatureValue(multiArray: validMaskArr),
          "encoder_mask": MLFeatureValue(multiArray: encoderMask),
        ])
        let decodeOutput = try models.decodeDecoder.prediction(
          from: decodeInput,
          using: state
        )
        guard
          let logits = decodeOutput.featureValue(for: "logits")?
            .multiArrayValue
        else {
          throw NSError(
            domain: "CohereAsrService",
            code: 16,
            userInfo: [NSLocalizedDescriptionKey: "Missing logits from decode"]
          )
        }

        // Copy logits into a local buffer (CoreML's MLMultiArray
        // can be read-only; modifying in place is a contract risk).
        let vocabSize = Self.vocabSize
        let srcPtr = logits.dataPointer.bindMemory(
          to: Float.self,
          capacity: vocabSize
        )
        var localLogits = [Float](
          unsafeUninitializedCapacity: vocabSize
        ) { buf, count in
          buf.baseAddress!.initialize(from: srcPtr, count: vocabSize)
          count = vocabSize
        }

        if !models.encoderUsesDynamicLength {
          // Heuristic stop: when the model's confidence in EOS is
          // outpaced by fewer than 3 other tokens, treat as
          // implicit EOS. Prevents long hallucination tails on
          // chunks where the encoder can't signal length cleanly.
          let eosLogit = localLogits[Self.eosTokenId]
          var countAboveEos = 0
          for i in 0..<vocabSize {
            if localLogits[i] > eosLogit { countAboveEos += 1 }
            if countAboveEos >= 3 { break }
          }
          if countAboveEos < 3 {
            shouldStop = true
            return
          }

          // No-repeat-ngram-4 to suppress n-gram-level repetition
          // (a common Whisper-family failure mode on silence /
          // music).
          let noRepeatNgram = 4
          if generatedIds.count >= noRepeatNgram {
            let prefix = Array(generatedIds.suffix(noRepeatNgram - 1))
            for i in 0...(generatedIds.count - noRepeatNgram) {
              if Array(generatedIds[i..<(i + noRepeatNgram - 1)]) == prefix {
                localLogits[generatedIds[i + noRepeatNgram - 1]] =
                  -.greatestFiniteMagnitude
              }
            }
          }
        }

        nextToken = argmaxLocal(logits: localLogits)
      }
      if shouldStop { break }
      currentPosition += 1
    }

    let raw = models.tokenizer.decode(tokenIds: generatedIds)
    return Self.cleanTranscript(raw)
  }

  /// Schedule overlapping chunks for a long buffer. Returns
  /// the input as a single chunk if it fits under
  /// `maxAudioSamples`. Otherwise overlaps by
  /// `chunkOverlapSamples` so adjacent chunks share content the
  /// trigram merge can use to dedup boundaries.
  private func scheduleChunks(samples: [Float]) -> [[Float]] {
    let maxSamples = Self.maxAudioSamples
    if samples.count <= maxSamples {
      return [samples]
    }
    let overlap = Self.chunkOverlapSamples
    let stride = maxSamples - overlap
    var chunks: [[Float]] = []
    var startIdx = 0
    while startIdx < samples.count {
      let endIdx = min(startIdx + maxSamples, samples.count)
      chunks.append(Array(samples[startIdx..<endIdx]))
      startIdx += stride
      if endIdx == samples.count { break }
    }
    return chunks
  }

  // MARK: - Mask caching

  /// One-hot mask marking the position currently being written to
  /// the KV cache. Cached per-position because decode loops hit
  /// the same positions repeatedly across chunks within a meeting.
  private func cachedUpdateMask(for position: Int) throws -> MLMultiArray {
    if let cached = updateMaskCache[position] { return cached }
    let array = try MLMultiArray(
      shape: [1, NSNumber(value: Self.maxSeqLen)],
      dataType: .float32
    )
    let ptr = array.dataPointer.bindMemory(
      to: Float.self,
      capacity: Self.maxSeqLen
    )
    ptr.initialize(repeating: 0, count: Self.maxSeqLen)
    if position < Self.maxSeqLen { ptr[position] = 1 }
    updateMaskCache[position] = array
    return array
  }

  /// Mask of already-committed positions (everything strictly
  /// before the current write position). Cached per-position.
  private func cachedValidMask(for position: Int) throws -> MLMultiArray {
    if let cached = validMaskCache[position] { return cached }
    let array = try MLMultiArray(
      shape: [1, NSNumber(value: Self.maxSeqLen)],
      dataType: .float32
    )
    let ptr = array.dataPointer.bindMemory(
      to: Float.self,
      capacity: Self.maxSeqLen
    )
    ptr.initialize(repeating: 0, count: Self.maxSeqLen)
    for index in 0..<position { ptr[index] = 1 }
    validMaskCache[position] = array
    return array
  }

  // MARK: - Argmax helpers

  private func argmaxLocal(logits: [Float]) -> Int {
    guard !logits.isEmpty else { return 0 }
    var maxVal = logits[0]
    var maxIdx = 0
    for i in 1..<logits.count {
      if logits[i] > maxVal {
        maxVal = logits[i]
        maxIdx = i
      }
    }
    return maxIdx
  }

  private func argmaxLastPosition(logits: MLMultiArray, seqLen: Int) -> Int {
    let vocabSize = Self.vocabSize
    let offset = (seqLen - 1) * vocabSize
    let ptr = logits.dataPointer.bindMemory(
      to: Float.self,
      capacity: seqLen * vocabSize
    )
    var maxVal = ptr[offset]
    var maxIdx = 0
    for i in 1..<vocabSize {
      if ptr[offset + i] > maxVal {
        maxVal = ptr[offset + i]
        maxIdx = i
      }
    }
    return maxIdx
  }

  // MARK: - Mel computation
  //
  // Wraps the standalone `CohereMelSpectrogram` extractor that
  // `CohereModels.load` constructs. Inlined here so the call site
  // is one line; the actual vDSP heavy-lifting lives below.

  private func computeMel(
    audio: [Float],
    models: CohereModels
  ) -> (mel: [Float], realFrameCount: Int) {
    return models.melExtractor.compute(audio: audio)
  }

  // MARK: - Output cleanup

  /// Strip Whisper-family special tokens that occasionally leak
  /// into the decoded text + trim repeated trailing sentences (the
  /// most common Cohere failure mode on tail-silence).
  static func cleanTranscript(_ text: String) -> String {
    var cleaned = text
    if let range = cleaned.range(of: "<|endoftext|>") {
      cleaned = String(cleaned[cleaned.startIndex..<range.lowerBound])
    }
    let leakTokens = [
      "<|nospeech|>",
      "<|startofcontext|>",
      "<|startoftranscript|>",
      "<|notimestamp|>",
      "<|nodiarize|>",
      "<|pnc|>",
      "<|noitn|>",
      "<|emo:undefined|>",
    ]
    for token in leakTokens {
      cleaned = cleaned.replacingOccurrences(of: token, with: "")
    }
    cleaned = trimRepeatedSuffix(cleaned)
    return cleaned.trimmingCharacters(in: .whitespacesAndNewlines)
  }

  /// Trim repeated trailing sentence runs — when the decoder
  /// loops on tail silence it repeats the same sentence multiple
  /// times. Match Muesli's heuristic: 4+ sentences and any earlier
  /// one within 3 positions matches the latest sentence.
  private static func trimRepeatedSuffix(_ text: String) -> String {
    let sentences = text.components(separatedBy: ". ")
    guard sentences.count >= 4 else { return text }

    for i in 1..<sentences.count {
      let current = sentences[i].trimmingCharacters(in: .whitespacesAndNewlines)
      guard !current.isEmpty else { continue }
      for j in 0..<i {
        let earlier = sentences[j].trimmingCharacters(in: .whitespacesAndNewlines)
        if current == earlier && i - j <= 3 {
          let kept = sentences[0..<i].joined(separator: ". ")
          if !kept.hasSuffix(".") && !kept.hasSuffix("!") && !kept.hasSuffix("?") {
            return kept + "."
          }
          return kept
        }
      }
    }
    return text
  }
}

// MARK: - CohereModels (CoreML loading)

/// Holds the three CoreML models + tokenizer + mel extractor
/// after `load()` succeeds. Internal-only — the public service
/// (`CohereAsrService`) wraps this.
@available(macOS 15, *)
private struct CohereModels {
  let encoder: MLModel
  let encoderUsesDynamicLength: Bool
  let prefillDecoder: MLModel
  let decodeDecoder: MLModel
  let tokenizer: CohereSentencePieceDecoder
  let melExtractor: CohereMelSpectrogram

  static func load(
    from directory: URL,
    computeUnits: MLComputeUnits = .all
  ) async throws -> CohereModels {
    let config = MLModelConfiguration()
    config.computeUnits = computeUnits

    let encoder = try await loadModel(
      packageName: "cohere_encoder_dynamic.mlpackage",
      from: directory,
      configuration: config
    )
    let prefill = try await loadModel(
      packageName: "cohere_decoder_prefill_int8.mlpackage",
      from: directory,
      configuration: config
    )
    let decode = try await loadModel(
      packageName: "cohere_decoder_decode_int8.mlpackage",
      from: directory,
      configuration: config
    )
    let tokenizer = try CohereSentencePieceDecoder(
      modelURL: directory.appending(path: "tokenizer.model")
    )
    let melExtractor = try CohereMelSpectrogram(directory: directory)
    let lengthAware = encoder.modelDescription
      .inputDescriptionsByName.keys.contains("length")

    return CohereModels(
      encoder: encoder,
      encoderUsesDynamicLength: lengthAware,
      prefillDecoder: prefill,
      decodeDecoder: decode,
      tokenizer: tokenizer,
      melExtractor: melExtractor
    )
  }

  /// Load a single .mlpackage. Compiles to .mlmodelc if needed,
  /// then loads. Caches the .mlmodelc next to the .mlpackage so
  /// future loads skip the (slow) compile step.
  private static func loadModel(
    packageName: String,
    from directory: URL,
    configuration: MLModelConfiguration
  ) async throws -> MLModel {
    let packageURL = directory.appending(path: packageName)
    let compiledURL = directory.appending(
      path: packageName.replacingOccurrences(
        of: ".mlpackage",
        with: ".mlmodelc"
      )
    )

    let modelURL: URL
    if FileManager.default.fileExists(atPath: compiledURL.path) {
      modelURL = compiledURL
    } else {
      let compileStart = Date()
      NSLog("[CohereAsrService] compiling %@ (first-launch one-time cost)", packageName)
      let compiledTemp = try await MLModel.compileModel(at: packageURL)
      try? FileManager.default.removeItem(at: compiledURL)
      try FileManager.default.copyItem(at: compiledTemp, to: compiledURL)
      try? FileManager.default.removeItem(at: compiledTemp)
      NSLog(
        "[CohereAsrService] compiled %@ in %.1fs",
        packageName,
        Date().timeIntervalSince(compileStart)
      )
      modelURL = compiledURL
    }

    return try await MLModel.load(contentsOf: modelURL, configuration: configuration)
  }
}

// MARK: - Mel spectrogram (NeMo-style FilterbankFeatures)

/// Compute log-mel spectrograms matching Cohere's training pipeline:
///   - Pre-emphasis (0.97)
///   - torch.stft with center=True, pad_mode="constant" (zero-pad)
///   - Slaney-normalised mel filterbank (librosa.filters.mel norm='slaney')
///   - log(x + 2^-24) guard
///   - Per-feature normalisation with Bessel-corrected std + dither
///
/// Filterbank + window are loaded as raw fp32 binary blobs from the
/// model directory (`cohere_mel_filterbank.bin`, `cohere_mel_window.bin`).
/// vDSP / Accelerate handles the heavy lifting; per-call allocations
/// are minimised by pre-allocating scratch buffers in compute().
private final class CohereMelSpectrogram {
  private let filterBank: [Float]  // [nMels * nBins], flat row-major
  private let window: [Float]      // [winLength]
  private let nMels: Int
  private let nBins: Int
  private let nFFT: Int
  private let hop: Int
  private let winLength: Int
  private let fftSetup: FFTSetup
  private let fftLog2n: vDSP_Length

  private static let preemph: Float = 0.97
  private static let logZeroGuard: Float = 5.960_464_477_539_063e-08 // 2^-24
  private static let ditherConstant: Float = 1e-05

  init(directory: URL) throws {
    let nMels = 128
    let nFFT = 512
    let winLength = 400
    let hop = 160
    let nBins = nFFT / 2 + 1

    self.nMels = nMels
    self.nBins = nBins
    self.nFFT = nFFT
    self.hop = hop
    self.winLength = winLength

    // Filterbank: [128 mels x 257 bins] = 128*257*4 bytes = 131,584 bytes.
    let fbURL = directory.appending(path: "cohere_mel_filterbank.bin")
    let fbData = try Data(contentsOf: fbURL)
    let expectedFBBytes = nMels * nBins * MemoryLayout<Float>.stride
    guard fbData.count >= expectedFBBytes else {
      throw NSError(
        domain: "CohereAsrService",
        code: 21,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Mel filterbank file too small: \(fbData.count) < \(expectedFBBytes)"
        ]
      )
    }
    self.filterBank = fbData.withUnsafeBytes { raw in
      Array(raw.bindMemory(to: Float.self).prefix(nMels * nBins))
    }

    // Window: [400] fp32 hann (periodic=False).
    let winURL = directory.appending(path: "cohere_mel_window.bin")
    let winData = try Data(contentsOf: winURL)
    let expectedWinBytes = winLength * MemoryLayout<Float>.stride
    guard winData.count >= expectedWinBytes else {
      throw NSError(
        domain: "CohereAsrService",
        code: 22,
        userInfo: [
          NSLocalizedDescriptionKey:
            "Mel window file too small: \(winData.count) < \(expectedWinBytes)"
        ]
      )
    }
    self.window = winData.withUnsafeBytes { raw in
      Array(raw.bindMemory(to: Float.self).prefix(winLength))
    }

    let log2n = vDSP_Length(log2(Double(nFFT)))
    self.fftLog2n = log2n
    guard let setup = vDSP_create_fftsetup(log2n, FFTRadix(kFFTRadix2)) else {
      throw NSError(
        domain: "CohereAsrService",
        code: 23,
        userInfo: [
          NSLocalizedDescriptionKey: "Failed to create FFT setup for nFFT=\(nFFT)"
        ]
      )
    }
    self.fftSetup = setup
  }

  deinit {
    vDSP_destroy_fftsetup(fftSetup)
  }

  /// Compute log-mel spectrogram from raw 16 kHz audio.
  /// Returns flat [nMels * 3500] row-major + the actual
  /// number of mel frames before zero-padding.
  func compute(audio: [Float]) -> (mel: [Float], realFrameCount: Int) {
    let count = audio.count
    let melLength = 3500

    // 1. Pre-emphasis: x[n] = x[n] - 0.97 * x[n-1].
    var preemph = [Float](repeating: 0, count: count)
    if count > 0 { preemph[0] = audio[0] }
    if count > 1 {
      var negCoeff = -Self.preemph
      audio.withUnsafeBufferPointer { audioBuf in
        preemph.withUnsafeMutableBufferPointer { outBuf in
          vDSP_vsmul(
            audioBuf.baseAddress!, 1,
            &negCoeff,
            outBuf.baseAddress! + 1, 1,
            vDSP_Length(count - 1)
          )
          vDSP_vadd(
            outBuf.baseAddress! + 1, 1,
            audioBuf.baseAddress! + 1, 1,
            outBuf.baseAddress! + 1, 1,
            vDSP_Length(count - 1)
          )
        }
      }
    }

    // 2. center=True, pad_mode="constant" — zero-pad both sides by nFFT/2.
    let pad = nFFT / 2
    var padded = [Float](repeating: 0, count: pad + count + pad)
    _ = preemph.withUnsafeBufferPointer { src in
      padded.withUnsafeMutableBufferPointer { dst in
        memcpy(
          dst.baseAddress! + pad,
          src.baseAddress!,
          count * MemoryLayout<Float>.stride
        )
      }
    }

    let nRealFrames = min(1 + (padded.count - nFFT) / hop, melLength)

    // 3. STFT → power spectrum.
    var frame = [Float](repeating: 0, count: nFFT)
    let halfN = nFFT / 2
    var realPart = [Float](repeating: 0, count: halfN)
    var imagPart = [Float](repeating: 0, count: halfN)
    let log2n = fftLog2n

    var powerSpec = [Float](repeating: 0, count: nRealFrames * nBins)
    var reSq = [Float](repeating: 0, count: halfN - 1)
    var imSq = [Float](repeating: 0, count: halfN - 1)

    padded.withUnsafeBufferPointer { paddedBuf in
      for f in 0..<nRealFrames {
        let frameStart = f * hop

        // Apply window: padded[start..start+winLength] * window.
        frame.withUnsafeMutableBufferPointer { frameBuf in
          vDSP_vmul(
            paddedBuf.baseAddress! + frameStart, 1,
            window, 1,
            frameBuf.baseAddress!, 1,
            vDSP_Length(winLength)
          )
          if nFFT > winLength {
            vDSP_vclr(
              frameBuf.baseAddress! + winLength, 1,
              vDSP_Length(nFFT - winLength)
            )
          }
        }

        // FFT (real input, in-place split-complex output).
        realPart.withUnsafeMutableBufferPointer { rBuf in
          imagPart.withUnsafeMutableBufferPointer { iBuf in
            var splitComplex = DSPSplitComplex(
              realp: rBuf.baseAddress!,
              imagp: iBuf.baseAddress!
            )
            frame.withUnsafeBufferPointer { frameBuf in
              frameBuf.baseAddress!.withMemoryRebound(
                to: DSPComplex.self,
                capacity: halfN
              ) { complexPtr in
                vDSP_ctoz(complexPtr, 2, &splitComplex, 1, vDSP_Length(halfN))
              }
            }
            vDSP_fft_zrip(
              fftSetup,
              &splitComplex,
              1,
              log2n,
              FFTDirection(kFFTDirection_Forward)
            )

            // Power spectrum: |re|² + |im|² for bins 1..halfN-1;
            // bins 0 and halfN unpacked from rBuf[0] / iBuf[0].
            let psRow = f * nBins
            powerSpec.withUnsafeMutableBufferPointer { psBuf in
              let dst = psBuf.baseAddress! + psRow
              dst[0] = rBuf[0] * rBuf[0]
              dst[halfN] = iBuf[0] * iBuf[0]
              vDSP_vsq(rBuf.baseAddress! + 1, 1, &reSq, 1, vDSP_Length(halfN - 1))
              vDSP_vsq(iBuf.baseAddress! + 1, 1, &imSq, 1, vDSP_Length(halfN - 1))
              vDSP_vadd(reSq, 1, imSq, 1, dst + 1, 1, vDSP_Length(halfN - 1))
            }
          }
        }
      }
    }

    // 4. Mel filterbank matmul: melRaw[nMels, nFrames] =
    //    filterBank[nMels, nBins] x powerSpecT[nBins, nFrames].
    var powerSpecT = [Float](repeating: 0, count: nBins * nRealFrames)
    vDSP_mtrans(
      powerSpec, 1,
      &powerSpecT, 1,
      vDSP_Length(nBins),
      vDSP_Length(nRealFrames)
    )

    var melRaw = [Float](repeating: 0, count: nMels * nRealFrames)
    vDSP_mmul(
      filterBank, 1,
      powerSpecT, 1,
      &melRaw, 1,
      vDSP_Length(nMels),
      vDSP_Length(nRealFrames),
      vDSP_Length(nBins)
    )

    // 5. log(x + 2^-24).
    var guardVal = Self.logZeroGuard
    var logMel = [Float](repeating: 0, count: nMels * nRealFrames)
    vDSP_vsadd(melRaw, 1, &guardVal, &logMel, 1, vDSP_Length(nMels * nRealFrames))
    var vecLen = Int32(nMels * nRealFrames)
    vvlogf(&logMel, logMel, &vecLen)

    // 6. Per-feature Bessel-corrected normalisation + dither, then
    //    zero-pad to melLength.
    var melSpec = [Float](repeating: 0, count: nMels * melLength)
    let nrf = vDSP_Length(nRealFrames)
    let invNm1 = 1.0 / Float(max(nRealFrames - 1, 1))

    for m in 0..<nMels {
      let srcOffset = m * nRealFrames
      let dstOffset = m * melLength

      var mean: Float = 0
      vDSP_meanv(
        logMel.withUnsafeBufferPointer { $0.baseAddress! + srcOffset }, 1,
        &mean, nrf
      )

      var negMean = -mean
      var centered = [Float](repeating: 0, count: nRealFrames)
      vDSP_vsadd(
        logMel.withUnsafeBufferPointer { $0.baseAddress! + srcOffset }, 1,
        &negMean, &centered, 1, nrf
      )
      var sumSq: Float = 0
      vDSP_dotpr(centered, 1, centered, 1, &sumSq, nrf)
      let std = sqrtf(sumSq * invNm1) + Self.ditherConstant

      var invStd = 1.0 / std
      melSpec.withUnsafeMutableBufferPointer { buf in
        vDSP_vsmul(centered, 1, &invStd, buf.baseAddress! + dstOffset, 1, nrf)
      }
    }

    return (melSpec, nRealFrames)
  }
}

// MARK: - SentencePiece tokenizer

/// Minimal SentencePiece decoder. Parses the protobuf model file
/// to extract the vocabulary, then maps token IDs back to text by
/// concatenating pieces and replacing the SentencePiece word-
/// boundary marker (▁ U+2581) with spaces.
///
/// Decode-only; we never re-tokenise text since we never feed
/// arbitrary text into Cohere — only fixed prompt token IDs.
private final class CohereSentencePieceDecoder {
  private let vocabulary: [Int: String]

  init(modelURL: URL) throws {
    let data = try Data(contentsOf: modelURL)
    self.vocabulary = try Self.parseVocabulary(from: data)
  }

  func decode(tokenIds: [Int]) -> String {
    let pieces = tokenIds.compactMap { vocabulary[$0] }
    let raw = pieces.joined()
    return raw.replacingOccurrences(of: "\u{2581}", with: " ")
      .trimmingCharacters(in: .whitespacesAndNewlines)
  }

  /// Parse the SentencePiece protobuf:
  ///   ModelProto { repeated SentencePiece pieces = 1; ... }
  ///   SentencePiece  { string piece = 1; float score = 2; ... }
  /// We only need field 1 (piece) of each SentencePiece. Token IDs
  /// are implicit by index — first piece is ID 0, second is 1, etc.
  private static func parseVocabulary(from data: Data) throws -> [Int: String] {
    var vocab: [Int: String] = [:]
    var index = 0
    var tokenId = 0

    while index < data.count {
      let (tag, newIndex) = readVarint(data: data, offset: index)
      index = newIndex
      let fieldNumber = tag >> 3
      let wireType = tag & 0x07

      if fieldNumber == 1 && wireType == 2 {
        let (msgLen, msgStart) = readVarint(data: data, offset: index)
        index = msgStart
        let msgEnd = index + Int(msgLen)

        var innerIndex = index
        var piece: String?
        while innerIndex < msgEnd {
          let (innerTag, innerNew) = readVarint(data: data, offset: innerIndex)
          innerIndex = innerNew
          let innerField = innerTag >> 3
          let innerWire = innerTag & 0x07

          if innerField == 1 && innerWire == 2 {
            let (strLen, strStart) = readVarint(data: data, offset: innerIndex)
            innerIndex = strStart
            let strEnd = innerIndex + Int(strLen)
            if strEnd <= data.count {
              piece = String(data: data[innerIndex..<strEnd], encoding: .utf8)
            }
            innerIndex = strEnd
          } else if innerWire == 0 {
            let (_, next) = readVarint(data: data, offset: innerIndex)
            innerIndex = next
          } else if innerWire == 2 {
            let (skipLen, skipStart) = readVarint(data: data, offset: innerIndex)
            innerIndex = skipStart + Int(skipLen)
          } else if innerWire == 5 {
            innerIndex += 4
          } else if innerWire == 1 {
            innerIndex += 8
          } else {
            break
          }
        }

        if let piece { vocab[tokenId] = piece }
        tokenId += 1
        index = msgEnd
      } else if wireType == 0 {
        let (_, next) = readVarint(data: data, offset: index)
        index = next
      } else if wireType == 2 {
        let (skipLen, skipStart) = readVarint(data: data, offset: index)
        index = skipStart + Int(skipLen)
      } else if wireType == 5 {
        index += 4
      } else if wireType == 1 {
        index += 8
      } else {
        break
      }
    }

    guard !vocab.isEmpty else {
      throw NSError(
        domain: "CohereAsrService",
        code: 20,
        userInfo: [
          NSLocalizedDescriptionKey: "Failed to parse SentencePiece vocabulary"
        ]
      )
    }
    return vocab
  }

  private static func readVarint(data: Data, offset: Int) -> (UInt64, Int) {
    var result: UInt64 = 0
    var shift = 0
    var pos = offset
    while pos < data.count {
      let byte = data[pos]
      result |= UInt64(byte & 0x7F) << shift
      pos += 1
      if byte & 0x80 == 0 { break }
      shift += 7
      if shift >= 64 { break }
    }
    return (result, pos)
  }
}
