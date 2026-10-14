// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "TranscriptionServer",
  // macOS 14.4 minimum (AudioHardwareCreateProcessTap requirement).
  // Cohere Transcribe 2B requires macOS 15 for MLState; that's
  // enforced at the call-site via `@available(macOS 15, *)` rather
  // than the package platform so the binary still compiles+links
  // against 14.4-vintage SDKs and avoids the Phase-8d-test issue
  // where bumping to 15 + clearing the CoreML cache caused an MPS
  // assertion crash inside the Cohere encoder forward pass.
  platforms: [.macOS("14.4")],
  dependencies: [
    // FluidAudio: Silero VAD (orphaned post-Phase-8d/e but still
    // loaded — small + future per-chunk Cohere path could re-use)
    // and Parakeet-TDT for the live draft transcript pipeline
    // (Phase-7: replaced Whisper-tiny).
    .package(
      url: "https://github.com/FluidInference/FluidAudio.git",
      from: "0.14.1"
    ),
    // DTLN-AEC (Dual-signal Transformation LSTM Network for
    // Acoustic Echo Cancellation) as CoreML. Used by
    // MeetingNeuralAec to subtract the remote / system-audio
    // reference signal from the mic stream, removing the speaker
    // bleed-back when users record on laptop speakers instead of
    // headphones. Substantial transcription-quality lift in that
    // case (the post-stop engine otherwise transcribes the
    // speaker's voice twice — once from the system stream and
    // once from the mic echo).
    .package(
      url: "https://github.com/MimicScribe/dtln-aec-coreml.git",
      from: "0.4.0-beta"
    ),
  ],
  targets: [
    .executableTarget(
      name: "transcription-server",
      dependencies: [
        .product(name: "FluidAudio", package: "FluidAudio"),
        // DTLN-AEC: framework + 512-frame model bundle. Both
        // products needed — framework provides DTLNAecEchoProcessor;
        // the bundle contains the CoreML model resources that
        // MeetingAecModelBundle resolves at runtime.
        .product(name: "DTLNAecCoreML", package: "dtln-aec-coreml"),
        .product(name: "DTLNAec512", package: "dtln-aec-coreml"),
      ],
      path: "Sources",
      linkerSettings: [
        .linkedFramework("AVFoundation"),
        .linkedFramework("CoreAudio"),
      ]
    )
  ]
)
