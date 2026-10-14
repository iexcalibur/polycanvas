import path from 'node:path';

import type { NativeRecordingController } from './coordinator';
import { callServer, ensureTranscriptionServer } from './transcription-server';

/**
 * Phase-7.6: Swift-backed `NativeRecordingController`.
 *
 * Replaces the Rust `media_capture` crate as the audio recording
 * backend. The Swift transcription server now owns:
 *   - Mic capture (`AVAudioEngine`)
 *   - System audio capture (`ScreenCaptureKit` `SCStream`)
 *   - Live processing (Parakeet streaming + DTLN-AEC)
 *   - Disk writes (`AVAudioFile` AAC m4a)
 *
 * This module wraps the HTTP endpoints in the same shape as the
 * Rust napi binding so `RecordingCoordinator` doesn't need to
 * change. From the coordinator's POV, calling
 * `nativeController.startRecording({ outputDir, id, ... })` works
 * exactly the same — paths get generated, Swift writes the m4a,
 * artifact comes back the same shape.
 *
 * Single capture, single source of truth: macOS no longer hosts
 * two simultaneous audio taps for the same meeting.
 *
 * **Path conventions** (preserved from Rust for compatibility):
 *   - Single-track:  `{outputDir}/{id}.m4a`
 *   - Dual-track:    `{outputDir}/{id}-mic.m4a`
 *                    `{outputDir}/{id}-sys.m4a`
 * The post-stop pipeline + history both expect these names; deviating
 * would silently break things.
 */
export function makeSwiftNativeRecordingController(): NativeRecordingController {
  return {
    async startRecording(options) {
      await ensureTranscriptionServer();

      // Path generation moves from Rust to here. Same conventions
      // so no downstream consumer needs to change.
      const includeSystemAudio = !!options.includeSystemAudio;
      const audioPath = includeSystemAudio
        ? path.join(options.outputDir, `${options.id}-mic.m4a`)
        : path.join(options.outputDir, `${options.id}.m4a`);
      const systemAudioPath = includeSystemAudio
        ? path.join(options.outputDir, `${options.id}-sys.m4a`)
        : undefined;

      // Tell Swift to start capture + writer. Returns the same paths
      // back (echoed) plus a success flag.
      await callServer('POST', '/meeting/start', {
        audioPath,
        systemAudioPath,
      });

      // Return the artifact in the shape RecordingCoordinator expects.
      // sampleRate / channels are nominal — actual rate is whatever
      // the audio device delivers (typically 48 kHz). The coordinator
      // surfaces these to UI but they're not load-bearing for any
      // feature; reasonable defaults are fine.
      return {
        id: options.id,
        filepath: audioPath,
        sampleRate: 48_000,
        channels: 1,
        startedAt: Date.now(),
      };
    },

    async stopRecording(_nativeId) {
      // Swift stores the paths it was told at /meeting/start time;
      // /meeting/stop returns them back. No need to pass nativeId —
      // there's only one active meeting per server at a time.
      const response = (await callServer(
        'POST',
        '/meeting/stop',
        {},
        // Long timeout: stop drains pending writes. Should be fast
        // (<1 s in practice) but encoding the last partial AAC
        // frame can take longer on large meetings.
        60_000
      )) as {
        audioPath?: string;
        systemAudioPath?: string;
      };

      if (!response.audioPath) {
        throw new Error('stopRecording: Swift did not return a mic audioPath');
      }

      return {
        id: _nativeId,
        filepath: response.audioPath,
        systemFilepath: response.systemAudioPath,
        // We don't surface real durationMs / size from Swift yet —
        // the coordinator's downstream consumers (history, UI)
        // don't strictly require these. Return zeros; they get
        // recomputed from the file when needed.
        sampleRate: 48_000,
        channels: 1,
        durationMs: 0,
        size: 0,
      };
    },

    async abortRecording(_nativeId) {
      try {
        await callServer('POST', '/meeting/cancel', {});
      } catch {
        // Cancel is best-effort. If Swift is unreachable or the
        // meeting already ended, nothing useful for the caller to
        // do — they're aborting anyway.
      }
    },
  };
}
