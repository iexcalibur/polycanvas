// eslint-disable no-var-requires

// Should not load @polycanvas/native for unsupported platforms

import { shell } from 'electron';

import { isMacOS, resolvePathInBase } from '../../shared/utils';
import { openExternalSafely } from '../security/open-external';
import type { NamespaceHandlers } from '../type';
import {
  askForMeetingPermission,
  checkMeetingPermissions,
  checkRecordingAvailable,
  claimRecordingImport,
  completeRecordingImport,
  deleteMeetingFromHistory,
  deleteMeetingsForDoc,
  disableRecordingFeature,
  dismissRecordingStatus,
  exportAudioFile,
  failRecordingImport,
  getCurrentRecordingStatus,
  getMeetingHistoryFromStorage,
  getRecording,
  getRecordingImportQueue,
  type MeetingHistoryRecord,
  readRecordingFile,
  recordingImportQueue$,
  recordingStatus$,
  removeRecording,
  resetAndAskMeetingPermission,
  resetSystemAudioGranted,
  SAVED_RECORDINGS_DIR,
  saveMeetingToHistory,
  type SerializedRecordingImportStatus,
  type SerializedRecordingStatus,
  serializeRecordingStatus,
  setupRecordingFeature,
  startRecording,
  stopRecording,
} from './feature';
import { callServer, ensureTranscriptionServer } from './transcription-server';
import type { AppGroupInfo } from './types';

export const recordingHandlers = {
  getRecording: async (_, id: number) => {
    return getRecording(id);
  },
  getCurrentRecording: async () => {
    // not all properties are serializable, so we need to return a subset of the status
    const status = getCurrentRecordingStatus();
    return status ? serializeRecordingStatus(status) : null;
  },
  startRecording: async (
    _,
    appGroup?: AppGroupInfo | number,
    options?: { includeSystemAudio?: boolean }
  ) => {
    return startRecording(appGroup, options);
  },
  stopRecording: async (_, id: number) => {
    return stopRecording(id);
  },
  readRecordingFile: async (_, filepath: string) => {
    return readRecordingFile(filepath);
  },
  getRecordingImportQueue: async () => {
    return getRecordingImportQueue();
  },
  claimRecordingImport: async (_, id: number, workspaceId: string) => {
    return claimRecordingImport(id, workspaceId);
  },
  completeRecordingImport: async (_, id: number) => {
    return completeRecordingImport(id);
  },
  dismissRecordingStatus: async (_, id: number) => {
    return dismissRecordingStatus(id);
  },
  failRecordingImport: async (_, id: number, errorMessage?: string) => {
    return failRecordingImport(id, errorMessage);
  },
  removeRecording: async (_, id: number) => {
    return removeRecording(id);
  },
  checkRecordingAvailable: async () => {
    return checkRecordingAvailable();
  },
  setupRecordingFeature: async () => {
    return setupRecordingFeature();
  },
  disableRecordingFeature: async () => {
    return disableRecordingFeature();
  },
  checkMeetingPermissions: async () => {
    return checkMeetingPermissions();
  },
  askForMeetingPermission: async (
    _,
    type: 'screen' | 'microphone' | 'accessibility'
  ) => {
    return askForMeetingPermission(type);
  },
  resetSystemAudioPermission: async () => {
    resetSystemAudioGranted();
  },
  resetAndAskMeetingPermission: async (
    _,
    type: 'microphone' | 'system-audio'
  ) => {
    return resetAndAskMeetingPermission(type);
  },
  showRecordingPermissionSetting: async (
    _,
    type: 'screen' | 'microphone' | 'system-audio' | 'accessibility'
  ) => {
    if (isMacOS()) {
      const urlMap: Record<string, string> = {
        microphone: 'Privacy_Microphone',
        'system-audio': 'Privacy_ScreenCapture',
        accessibility: 'Privacy_Accessibility',
      };
      const key = urlMap[type];
      if (key) {
        const url = `x-apple.systempreferences:com.apple.preference.security?${key}`;
        return openExternalSafely(url, {
          additionalProtocols: ['x-apple.systempreferences:'],
        });
      }
    }
    return false;
  },
  showSavedRecordings: async (_, subpath?: string) => {
    const directory = resolvePathInBase(SAVED_RECORDINGS_DIR, subpath ?? '', {
      label: 'directory',
    });
    return shell.showItemInFolder(directory);
  },
  // ---- Meeting history (SQLite-backed since v0.27.x) ----
  saveMeeting: async (_, meeting: MeetingHistoryRecord) => {
    await saveMeetingToHistory(meeting);
  },
  getMeetingHistory: async (_, docId?: string) => {
    return await getMeetingHistoryFromStorage(docId);
  },
  deleteMeeting: async (_, id: number) => {
    await deleteMeetingFromHistory(id);
  },
  deleteMeetingsForDoc: async (_, docId: string) => {
    return deleteMeetingsForDoc(docId);
  },
  exportMeetingAudio: async (_, audioFilePath: string) => {
    return exportAudioFile(audioFilePath);
  },
  // ---- Transcription server endpoints ----
  // Phase-8p: Audio capture is now owned by the Rust napi recorder
  // (in-process with Electron). The Swift transcription-server's
  // `MeetingCoordinator.startMeeting` would also try to claim the
  // input device for AVAudioEngine + the CoreAudio process tap;
  // running both at the same time contends for the mic and starves
  // the Rust recorder. We neutralise these IPC handlers to no-ops:
  // Swift only sees `/meeting/transcribe-file` calls now.
  //
  // The renderer still calls these (transcript.tsx) wrapped in
  // try/catch, so a no-op success keeps it happy. We DO ensure
  // the Swift server is up — it's still needed for the post-stop
  // transcribe-file pass.
  startMeeting: async (
    _,
    _audioPath?: string,
    _systemAudioPath?: string
  ) => {
    await ensureTranscriptionServer();
    return { success: true };
  },
  stopMeeting: async (_, _audioPath?: string) => {
    return { success: true, audioPath: '', systemAudioPath: undefined };
  },
  // Runs Cohere Transcribe on the recorded `.m4a`(s) end-to-end.
  //
  // Single-path call (mic-only mode): only `audioPath` supplied.
  // Server transcribes once, all segments returned with `speaker:
  // nil`.
  //
  // Dual-path call (system audio toggle was on, triple-track):
  // pass `audioPath` (mic-only) and `systemAudioPath` (system-only).
  // Server transcribes each independently with AEC on the mic pass
  // (using system as the reference signal), tags segments with
  // "You" / "Speaker" by stream provenance, and merges by timestamp
  // before returning. The blocking HTTP call waits for both passes.
  transcribeFile: async (
    _,
    audioPath: string,
    systemAudioPath?: string,
    diarise?: boolean,
    removeFillers?: boolean,
    customVocabulary?: { word: string; replacement: string; threshold: number }[]
  ) => {
    return callServer(
      'POST',
      '/meeting/transcribe-file',
      {
        audioPath,
        systemAudioPath,
        diarise,
        removeFillers,
        customVocabulary,
      },
      30 * 60 * 1000
    );
  },
  getMeetingStatus: async () => {
    return callServer('GET', '/meeting/status');
  },
  cancelMeeting: async () => {
    return callServer('POST', '/meeting/cancel');
  },
  getTranscriptionHealth: async () => {
    try {
      return await callServer('GET', '/health');
    } catch {
      return { status: 'down', modelsLoaded: false };
    }
  },
} satisfies NamespaceHandlers;

export const recordingEvents = {
  onRecordingStatusChanged: (
    fn: (status: SerializedRecordingStatus | null) => void
  ) => {
    const sub = recordingStatus$.subscribe(status => {
      fn(status ? serializeRecordingStatus(status) : null);
    });
    return () => {
      try {
        sub.unsubscribe();
      } catch {
        // ignore unsubscribe error
      }
    };
  },
  onRecordingImportQueueChanged: (
    fn: (queue: SerializedRecordingImportStatus[]) => void
  ) => {
    const sub = recordingImportQueue$.subscribe(queue => {
      fn(
        queue.map(item => ({
          id: item.id,
          appName: item.appName,
          workspaceId: item.workspaceId,
          docId: item.docId,
          startTime: item.startTime,
          filepath: item.filepath,
          micFilepath: item.micFilepath,
          systemFilepath: item.systemFilepath,
          sampleRate: item.sampleRate,
          numberOfChannels: item.numberOfChannels,
          durationMs: item.durationMs,
          size: item.size,
          degraded: item.degraded,
          overflowCount: item.overflowCount,
          importStatus: item.importStatus,
          errorMessage: item.errorMessage,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }))
      );
    });
    return () => {
      try {
        sub.unsubscribe();
      } catch {
        // ignore unsubscribe error
      }
    };
  },
};
