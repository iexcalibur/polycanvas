import type { ApplicationInfo } from '@polycanvas/native';

export interface TappableAppInfo {
  info: ApplicationInfo;
  isRunning: boolean;
  processId: number;
  processGroupId: number;
  bundleIdentifier: string;
  name: string;
}

export interface AppGroupInfo {
  processGroupId: number;
  apps: TappableAppInfo[];
  name: string;
  bundleIdentifier: string;
  icon: Buffer | undefined;
  isRunning: boolean;
}

export type RecordingJobPhase =
  | 'new'
  | 'starting'
  | 'recording'
  | 'finalizing'
  | 'recorded'
  | 'importing'
  | 'imported'
  | 'failed'
  | 'aborted';

export type RecordingFailureStage = 'start' | 'finalize' | 'import';

export interface RecordingFailureInfo {
  stage: RecordingFailureStage;
  message: string;
}

export type RecordingImportState =
  | 'pending_import'
  | 'importing'
  | 'imported'
  | 'import_failed';

export interface RecordingArtifactInfo {
  /**
   * Phase-8q: in triple-track mode this is the canonical pre-mixed
   * mic+system .m4a — the file the user hears when they replay the
   * meeting. In single-track mode it's the only file. Always set.
   */
  filepath: string;
  /**
   * Phase-8q: mic-only .m4a path (triple-track mode). When set, the
   * post-stop transcribe pass uses this as the "You" stream so
   * segments keep proper speaker provenance. Undefined in
   * single-track mode (then `filepath` is the mic stream).
   */
  micFilepath?: string;
  /**
   * Optional path to a parallel system-audio-only recording. Set only
   * when the meeting was captured in dual-track / triple-track mode
   * (system audio toggle on). Used by the transcription server as the
   * "Speaker" stream so segments keep "You" / "Speaker" provenance.
   */
  systemFilepath?: string;
  sampleRate?: number;
  numberOfChannels?: number;
  durationMs?: number;
  size?: number;
  degraded?: boolean;
  overflowCount?: number;
}

export interface RecordingImportProgress {
  workspaceId?: string;
  docId?: string;
  errorMessage?: string;
  leaseExpiresAt?: number;
  startedAt?: number;
  finishedAt?: number;
}

export interface RecordingJobStatus {
  id: number;
  phase: RecordingJobPhase;
  appName?: string;
  appGroupId?: number;
  bundleIdentifier?: string;
  appProcessId?: number;
  nativeId?: string;
  startTime: number;
  createdAt: number;
  updatedAt: number;
  artifact?: RecordingArtifactInfo;
  import?: RecordingImportProgress;
  error?: RecordingFailureInfo;
  dismissedAt?: number;
}

export interface RecordingImportStatus extends RecordingArtifactInfo {
  id: number;
  appName?: string;
  workspaceId?: string;
  docId?: string;
  startTime: number;
  importStatus: RecordingImportState;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export type RecordingDisplayState =
  | 'new'
  | 'starting'
  | 'start_failed'
  | 'recording'
  | 'finalizing'
  | 'pending_import'
  | 'importing'
  | 'imported'
  | 'import_failed'
  | 'finalize_failed';

export interface RecordingStatus {
  id: number;
  status: RecordingDisplayState;
  appName?: string;
  appGroupId?: number;
  icon?: Buffer;
  startTime: number;
  filepath?: string;
  /**
   * Phase-8q: mic-only `.m4a` path (triple-track mode). Renderer
   * uses this as the audioPath argument to transcribeFile so the
   * server's "You" pass operates on a clean mic stream rather than
   * the mixed file.
   */
  micFilepath?: string;
  /**
   * Optional system-audio path. Set only when the meeting was
   * recorded in dual-track / triple-track mode (system audio toggle
   * on). Used as the "Speaker" stream for transcription.
   */
  systemFilepath?: string;
  sampleRate?: number;
  numberOfChannels?: number;
  durationMs?: number;
  size?: number;
  degraded?: boolean;
  overflowCount?: number;
  errorMessage?: string;
}
