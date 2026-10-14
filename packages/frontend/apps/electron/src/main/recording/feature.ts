/* oxlint-disable no-var-requires */
import { execSync } from 'node:child_process';
import fsp from 'node:fs/promises';
import path from 'node:path';

import type * as NativeModuleType from '@polycanvas/native';
import { app, systemPreferences } from 'electron';
import fs from 'fs-extra';
import { debounce } from 'lodash-es';
import {
  BehaviorSubject,
  distinctUntilChanged,
  groupBy,
  interval,
  mergeMap,
  type Observable,
  Subject,
  throttleTime,
} from 'rxjs';
import { filter, map, shareReplay } from 'rxjs/operators';

import {
  isMacOS,
  isWindows,
  resolveExistingPathInBase,
  shallowEqual,
} from '../../shared/utils';
import { beforeAppQuit } from '../cleanup';
import { logger } from '../logger';
import {
  MeetingSettingsKey,
  MeetingSettingsSchema,
} from '../shared-state-schema';
import { globalStateStorage } from '../shared-storage/storage';
import { getMainWindow } from '../windows-manager';
import { popupManager } from '../windows-manager/popup';
import { isAppNameAllowed } from './allow-list';
import { RecordingCoordinator } from './coordinator';
// Phase-8p: Swift HTTP controller retired for audio capture (the
// spawned-child-process context blocked CoreAudio process-tap IO
// callbacks regardless of aggregate configuration — confirmed across
// 11 builds). Audio capture moves back into the Rust napi module
// loaded in-process with Electron, matching the proven 0.26.9x
// architecture. Swift transcription-server now only handles post-
// stop transcription via /meeting/transcribe-file.
// import { makeSwiftNativeRecordingController } from './swift-native-controller';
import type {
  AppGroupInfo,
  RecordingImportStatus,
  RecordingJobStatus,
  RecordingStatus,
  TappableAppInfo,
} from './types';

export const MeetingsSettingsState = {
  $: globalStateStorage.watch<MeetingSettingsSchema>(MeetingSettingsKey).pipe(
    map(v => MeetingSettingsSchema.parse(v ?? {})),
    shareReplay(1)
  ),

  get value() {
    return MeetingSettingsSchema.parse(
      globalStateStorage.get(MeetingSettingsKey) ?? {}
    );
  },

  set value(value: MeetingSettingsSchema) {
    globalStateStorage.set(MeetingSettingsKey, value);
  },
};

type Subscriber = {
  unsubscribe: () => void;
};

const subscribers: Subscriber[] = [];
let appStateSubscribers: Subscriber[] = [];

export const SAVED_RECORDINGS_DIR = path.join(
  app.getPath('sessionData'),
  'recordings'
);

type NativeModule = typeof NativeModuleType;
type ShareableContentType = InstanceType<NativeModule['ShareableContent']>;
type ShareableContentStatic = NativeModule['ShareableContent'];

let shareableContent: ShareableContentType | null = null;
let nativeModuleOverride: NativeModule | null = null;

function getNativeModule(): NativeModule {
  return nativeModuleOverride ?? (require('@polycanvas/native') as NativeModule);
}

async function getNativeModuleAsync(): Promise<NativeModule> {
  if (nativeModuleOverride) {
    return nativeModuleOverride;
  }
  return (await import('@polycanvas/native')) as NativeModule;
}

async function assertRecordingFilepath(filepath: string) {
  return await resolveExistingPathInBase(SAVED_RECORDINGS_DIR, filepath, {
    caseInsensitive: isWindows(),
    label: 'recording filepath',
  });
}

const recordingCoordinator = new RecordingCoordinator(
  SAVED_RECORDINGS_DIR,
  assertRecordingFilepath,
  // Phase-8p: revert audio capture to the Rust napi module. The
  // Swift HTTP-backed controller's CoreAudio process-tap aggregate
  // never received IO callbacks from the spawned child-process
  // context (`raw IO callbacks=0` across every aggregate config we
  // tried — built-in mic, AirPods, varying clock/sub-device combos,
  // dispatch-queue and nil-queue IO procs). Loading the recording
  // surface in-process with Electron sidesteps that issue entirely
  // — same architecture that worked in 0.26.9x.
  //
  // The Rust crate writes a SINGLE `<id>.m4a` per recording (mic +
  // optionally mixed system audio). Dual-track "You/Speaker"
  // labelling that the Swift writer used to emit is gone for now;
  // post-stop transcription gets one mixed audio file. Re-adding
  // dual-track output to the Rust crate is a follow-up.
  async () => {
    const nativeModule = await getNativeModuleAsync();
    return {
      startRecording: nativeModule.startRecording,
      stopRecording: nativeModule.stopRecording,
      abortRecording: nativeModule.abortRecording,
    };
  }
);

export function setRecordingNativeModuleForTesting(
  nativeModule: NativeModule | null
) {
  nativeModuleOverride = nativeModule;
}

function resetFeatureSubscriptions() {
  appStateSubscribers.forEach(subscriber => {
    try {
      subscriber.unsubscribe();
    } catch {
      // ignore unsubscribe error
    }
  });
  appStateSubscribers = [];
  subscribers.forEach(subscriber => {
    try {
      subscriber.unsubscribe();
    } catch {
      // ignore unsubscribe error
    }
  });
  subscribers.length = 0;
  shareableContent = null;
  applications$.next([]);
  appGroups$.next([]);
}

async function abortActiveRecording() {
  try {
    await recordingCoordinator.abortActive();
  } catch (error) {
    logger.error('failed to cleanup abandoned native recording', error);
  }
}

beforeAppQuit(() => {
  void abortActiveRecording().catch(() => undefined);
  resetFeatureSubscriptions();
});

export const applications$ = new BehaviorSubject<TappableAppInfo[]>([]);
export const appGroups$ = new BehaviorSubject<AppGroupInfo[]>([]);
export const updateApplicationsPing$ = new Subject<number>();

export const recordingStatus$: Observable<RecordingStatus | null> =
  recordingCoordinator.status$;
export const recordingImportQueue$: Observable<RecordingImportStatus[]> =
  recordingCoordinator.importQueue$;

export function getCurrentRecordingStatus() {
  return recordingCoordinator.currentStatus();
}

function hasActivePopupStatus(status: RecordingStatus | null | undefined) {
  return (
    status?.status === 'starting' ||
    status?.status === 'recording' ||
    status?.status === 'finalizing'
  );
}

function isTerminalPopupStatus(
  status: RecordingStatus | null | undefined
): status is RecordingStatus & {
  status: 'imported' | 'import_failed' | 'start_failed' | 'finalize_failed';
} {
  return (
    status?.status === 'imported' ||
    status?.status === 'import_failed' ||
    status?.status === 'start_failed' ||
    status?.status === 'finalize_failed'
  );
}

function createAppGroup(processGroupId: number): AppGroupInfo | undefined {
  const SC: ShareableContentStatic = getNativeModule().ShareableContent;
  const groupProcess = SC?.applicationWithProcessId(processGroupId);
  if (!groupProcess) {
    return;
  }
  return {
    processGroupId,
    apps: [],
    name: groupProcess.name,
    bundleIdentifier: groupProcess.bundleIdentifier,
    get icon() {
      try {
        return groupProcess.icon;
      } catch (error) {
        logger.error(`Failed to get icon for ${groupProcess.name}`, error);
        return undefined;
      }
    },
    isRunning: false,
  };
}

function setupAppGroups() {
  subscribers.push(
    applications$.pipe(distinctUntilChanged()).subscribe(apps => {
      const groups: AppGroupInfo[] = [];
      apps.forEach(appInfo => {
        let group = groups.find(
          entry => entry.processGroupId === appInfo.processGroupId
        );
        if (!group) {
          group = createAppGroup(appInfo.processGroupId);
          if (group) {
            groups.push(group);
          }
        }
        if (group) {
          group.apps.push(appInfo);
        }
      });

      groups.forEach(group => {
        group.isRunning = group.apps.some(app => app.isRunning);
      });

      appGroups$.next(groups);
    })
  );
}

function setupNewRunningAppGroup() {
  const appGroupRunningChanged$ = appGroups$.pipe(
    mergeMap(groups => groups),
    groupBy(group => group.processGroupId),
    mergeMap(groupStream$ =>
      groupStream$.pipe(
        distinctUntilChanged((prev, curr) => prev.isRunning === curr.isRunning)
      )
    ),
    filter(group => isAppNameAllowed(group.name))
  );

  // Auto-detect and auto-start recording for meeting apps is disabled.
  // Recording is only triggered manually via the FAB button.
}

export async function getRecording(id: number) {
  return recordingCoordinator.getRecording(id);
}

function setupRecordingListeners() {
  subscribers.push(
    recordingStatus$
      .pipe(distinctUntilChanged(shallowEqual))
      .subscribe(status => {
        const popup = popupManager.get('recording');

        if (status && !popup.showing) {
          void popup.show().catch(err => {
            logger.error('failed to show recording popup', err);
          });
        }

        if (isTerminalPopupStatus(status)) {
          setTimeout(
            () => {
              const currentStatus = getCurrentRecordingStatus();
              if (
                isTerminalPopupStatus(currentStatus) &&
                currentStatus.id === status.id
              ) {
                void popup.hide().catch(err => {
                  logger.error('failed to hide recording popup', err);
                });
                dismissRecordingStatus(status.id);
              }
            },
            status.status === 'import_failed' ||
              status.status === 'start_failed' ||
              status.status === 'finalize_failed'
              ? 30_000
              : 10_000
          );
        } else if (!status) {
          void popupManager
            .get('recording')
            .hide()
            .catch(err => {
              logger.error('failed to hide recording popup', err);
            });
        }
      })
  );
}

function getAllApps(): TappableAppInfo[] {
  if (!shareableContent) {
    return [];
  }

  const { ShareableContent } = getNativeModule();
  const apps = ShareableContent.applications().map(appInfo => {
    try {
      const isRunning = ShareableContent.isUsingMicrophone(appInfo.processId);
      return {
        info: appInfo,
        processId: appInfo.processId,
        processGroupId: appInfo.processGroupId,
        bundleIdentifier: appInfo.bundleIdentifier,
        name: appInfo.name,
        isRunning,
      };
    } catch (error) {
      logger.error('failed to get app info', error);
      return null;
    }
  });

  return apps.filter(
    (value): value is TappableAppInfo =>
      value !== null &&
      !value.bundleIdentifier.startsWith('com.apple') &&
      !value.bundleIdentifier.startsWith('pro.polymind') &&
      value.processId !== process.pid
  );
}

function setupMediaListeners() {
  const ShareableContent = getNativeModule().ShareableContent;
  applications$.next(getAllApps());
  subscribers.push(
    interval(3000).subscribe(() => {
      updateApplicationsPing$.next(Date.now());
    }),
    ShareableContent.onApplicationListChanged(() => {
      updateApplicationsPing$.next(Date.now());
    }),
    updateApplicationsPing$
      .pipe(distinctUntilChanged(), throttleTime(3000))
      .subscribe(() => {
        applications$.next(getAllApps());
      })
  );

  subscribers.push(
    applications$.subscribe(apps => {
      appStateSubscribers.forEach(subscriber => {
        try {
          subscriber.unsubscribe();
        } catch {
          // ignore unsubscribe error
        }
      });

      appStateSubscribers = apps.flatMap(appInfo => {
        try {
          return [
            ShareableContent.onAppStateChanged(appInfo.info, () => {
              updateApplicationsPing$.next(Date.now());
            }),
          ];
        } catch (error) {
          logger.error(
            `Failed to set up app state listener for ${appInfo.name}`,
            error
          );
          return [];
        }
      });
    })
  );
}

export function setupRecordingFeature() {
  if (!MeetingsSettingsState.value.enabled || !checkCanRecordMeeting()) {
    return;
  }

  try {
    const ShareableContent = getNativeModule().ShareableContent;
    if (!shareableContent) {
      shareableContent = new ShareableContent();
      setupMediaListeners();
    }
    setupAppGroups();
    setupNewRunningAppGroup();
    setupRecordingListeners();
    return true;
  } catch (error) {
    logger.error('failed to setup recording feature', error);
    return false;
  }
}

export async function disableRecordingFeature() {
  await abortActiveRecording();
  resetFeatureSubscriptions();
}

function normalizeAppGroupInfo(
  appGroup?: AppGroupInfo | number
): AppGroupInfo | undefined {
  return typeof appGroup === 'number'
    ? appGroups$.value.find(group => group.processGroupId === appGroup)
    : appGroup;
}

export function newRecording(
  appGroup?: AppGroupInfo | number
): RecordingStatus | null {
  recordingCoordinator.createPrompt(normalizeAppGroupInfo(appGroup));
  return serializeRecordingStatus(getCurrentRecordingStatus());
}

/**
 * Waits for a macOS media permission to be granted, polling every `intervalMs`.
 * Returns true once granted, or false after `timeoutMs`.
 */
function waitForMediaAccess(
  type: 'microphone' | 'camera' | 'screen',
  timeoutMs = 60_000,
  intervalMs = 500
): Promise<boolean> {
  return new Promise(resolve => {
    if (systemPreferences.getMediaAccessStatus(type) === 'granted') {
      resolve(true);
      return;
    }
    const start = Date.now();
    const timer = setInterval(() => {
      if (systemPreferences.getMediaAccessStatus(type) === 'granted') {
        clearInterval(timer);
        resolve(true);
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        resolve(false);
      }
    }, intervalMs);
  });
}

export async function startRecording(
  appGroup?: AppGroupInfo | number,
  options?: { includeSystemAudio?: boolean }
): Promise<RecordingStatus | null> {
  fs.ensureDirSync(SAVED_RECORDINGS_DIR);

  // Phase-8k: gate the actual recorder start on BOTH mic AND system
  // audio permissions. Previously we resolved mic synchronously and
  // let system audio "fail open" — the native tap would surface its
  // own dialog at first sample and the recording UI would already
  // be in `recording` state. If the user clicked Deny we silently
  // produced a mic-only recording with no system feed (and no
  // visible warning).
  //
  // Now both permissions must be `granted` before we touch the
  // recorder. If system audio is missing we trigger the native
  // tap-create dialog (`requestSystemAudioPermission`) and only
  // proceed if it returns true.
  if (isMacOS()) {
    // 1. Microphone — askForMediaAccess shows the system dialog
    //    and resolves once the user clicks Allow / Deny.
    const micStatus = systemPreferences.getMediaAccessStatus('microphone');
    if (micStatus !== 'granted') {
      logger.info('Requesting microphone permission...');
      const granted = await systemPreferences.askForMediaAccess('microphone');
      if (!granted) {
        logger.warn('Microphone permission denied — cannot start recording');
        return null;
      }
      logger.info('Microphone permission granted');
    }

    // 2. System audio — there's no Electron API for the audio-only
    //    TCC entry, so we trigger the dialog ourselves by creating
    //    a temporary `AudioHardwareCreateProcessTap` via the Rust
    //    binding's `requestSystemAudioPermission`. It returns
    //    synchronously on the second call (once the user picks
    //    Allow / Deny in the dialog) — true means granted, false
    //    means denied or unavailable.
    //
    //    We honour the cached `systemAudioConfirmedGranted` flag so
    //    we don't re-prompt on every recording start once the user
    //    has already granted.
    if (!systemAudioConfirmedGranted) {
      logger.info('Requesting system-audio permission...');
      try {
        const nativeModule = await getNativeModuleAsync();
        const granted = nativeModule.requestSystemAudioPermission();
        if (!granted) {
          logger.warn(
            'System audio permission denied — cannot start recording'
          );
          return null;
        }
        confirmSystemAudioGranted();
        logger.info('System audio permission granted');
      } catch (error) {
        logger.error('Failed to request system audio permission', error);
        return null;
      }
    }
  }

  const job = await recordingCoordinator.start(
    normalizeAppGroupInfo(appGroup),
    { includeSystemAudio: options?.includeSystemAudio ?? false }
  );

  return serializeJob(job);
}

export async function stopRecording(id: number) {
  const job = await recordingCoordinator.stop(id);
  if (job?.phase === 'recorded') {
    void getMainWindow()
      .then(mainWindow => {
        if (mainWindow) {
          mainWindow.show();
        }
      })
      .catch(err => {
        logger.error('failed to bring up the window', err);
      });
  }
  return serializeRecordingStatus(getCurrentRecordingStatus());
}

export async function readRecordingFile(filepath: string) {
  const normalizedPath = await assertRecordingFilepath(filepath);
  return fsp.readFile(normalizedPath);
}

export function getRecordingImportQueue() {
  return recordingCoordinator.importQueue().flatMap(status => {
    const serialized = serializeRecordingImportStatus(status);
    return serialized ? [serialized] : [];
  });
}

export function claimRecordingImport(id: number, workspaceId: string) {
  return serializeRecordingImportStatus(
    recordingCoordinator.claimImport(id, workspaceId)
  );
}

export function completeRecordingImport(id: number) {
  logger.info(`recording import ${id} completed`);
  return serializeRecordingImportStatus(
    recordingCoordinator.completeImport(id)
  );
}

export function failRecordingImport(id: number, errorMessage?: string) {
  logger.error(`recording import ${id} failed`, errorMessage);
  return serializeRecordingImportStatus(
    recordingCoordinator.failImport(id, errorMessage)
  );
}

export function dismissRecordingStatus(id: number) {
  return serializeRecordingStatus(recordingCoordinator.dismiss(id));
}

export function removeRecording(id: number) {
  recordingCoordinator.remove(id);
}

export interface SerializedRecordingStatus {
  id: number;
  status: RecordingStatus['status'];
  appName?: string;
  appGroupId?: number;
  icon?: Buffer;
  startTime: number;
  filepath?: string;
  /** Phase-8q: mic-only filepath (triple-track recordings). */
  micFilepath?: string;
  /** Optional dual-track system audio filepath. */
  systemFilepath?: string;
  sampleRate?: number;
  numberOfChannels?: number;
  durationMs?: number;
  size?: number;
  degraded?: boolean;
  overflowCount?: number;
  errorMessage?: string;
}

function serializeJob(job: RecordingJobStatus | null | undefined) {
  if (!job) {
    return null;
  }
  return serializeRecordingStatus(recordingCoordinator.currentStatus());
}

export function serializeRecordingStatus(
  status: RecordingStatus | null | undefined
): SerializedRecordingStatus | null {
  if (!status) {
    return null;
  }

  return {
    id: status.id,
    status: status.status,
    appName: status.appName,
    appGroupId: status.appGroupId,
    icon: status.icon,
    startTime: status.startTime,
    filepath: status.filepath,
    micFilepath: status.micFilepath,
    systemFilepath: status.systemFilepath,
    sampleRate: status.sampleRate,
    numberOfChannels: status.numberOfChannels,
    durationMs: status.durationMs,
    size: status.size,
    degraded: status.degraded,
    overflowCount: status.overflowCount,
    errorMessage: status.errorMessage,
  };
}

export interface SerializedRecordingImportStatus {
  id: number;
  appName?: string;
  workspaceId?: string;
  docId?: string;
  startTime: number;
  filepath: string;
  sampleRate?: number;
  numberOfChannels?: number;
  durationMs?: number;
  size?: number;
  degraded?: boolean;
  overflowCount?: number;
  importStatus: RecordingImportStatus['importStatus'];
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export function serializeRecordingImportStatus(
  status: RecordingImportStatus | null | undefined
): SerializedRecordingImportStatus | null {
  if (!status) {
    return null;
  }

  return {
    id: status.id,
    appName: status.appName,
    workspaceId: status.workspaceId,
    docId: status.docId,
    startTime: status.startTime,
    filepath: status.filepath,
    sampleRate: status.sampleRate,
    numberOfChannels: status.numberOfChannels,
    durationMs: status.durationMs,
    size: status.size,
    degraded: status.degraded,
    overflowCount: status.overflowCount,
    importStatus: status.importStatus,
    errorMessage: status.errorMessage,
    createdAt: status.createdAt,
    updatedAt: status.updatedAt,
  };
}

export const getMacOSVersion = () => {
  try {
    const stdout = execSync('sw_vers -productVersion').toString();
    const [major, minor, patch] = stdout.trim().split('.').map(Number);
    return { major, minor, patch };
  } catch (error) {
    logger.error('Failed to get MacOS version', error);
    return { major: 0, minor: 0, patch: 0 };
  }
};

export const checkRecordingAvailable = () => {
  if (isMacOS()) {
    const version = getMacOSVersion();
    return (version.major === 14 && version.minor >= 2) || version.major > 14;
  }
  if (isWindows()) {
    return true;
  }
  return false;
};

// On macOS 15+, system audio recording is a SEPARATE permission from screen
// recording.  Electron's getMediaAccessStatus('screen') only checks the screen
// recording TCC entry, so it returns 'denied' even when system audio IS granted
// via AudioHardwareCreateProcessTap.  We track the actual grant here.
let systemAudioConfirmedGranted = false;

/** Mark system audio as granted (after native dialog Allow or successful recording). */
export function confirmSystemAudioGranted() {
  systemAudioConfirmedGranted = true;
}

/** Clear the system audio grant flag (when user toggles OFF in Settings). */
export function resetSystemAudioGranted() {
  systemAudioConfirmedGranted = false;
}

export const checkMeetingPermissions = () => {
  if (isWindows()) {
    return {
      screen: true,
      microphone: true,
      systemAudio: true,
      accessibility: true,
    };
  }

  if (!isMacOS()) {
    return undefined;
  }

  const micGranted =
    systemPreferences.getMediaAccessStatus('microphone') === 'granted';
  const accessibilityGranted =
    systemPreferences.isTrustedAccessibilityClient(false);

  return {
    // Phase-8k: PolyMind no longer requests Screen Recording at all.
    // The audio path is fully on AudioHardwareCreateProcessTap, which
    // has its own TCC entry. We surface `screen` as identical to
    // `systemAudio` so any UI that still references it lights up
    // correctly without further plumbing changes.
    screen: systemAudioConfirmedGranted,
    microphone: micGranted,
    // On macOS 14.4+ (our minimum target), system audio recording
    // is a SEPARATE TCC entry from screen recording, populated only
    // by AudioHardwareCreateProcessTap. Electron's
    // getMediaAccessStatus has no probe for it, so we cache the
    // grant via `confirmSystemAudioGranted()` after a successful
    // tap-create call.
    systemAudio: systemAudioConfirmedGranted,
    accessibility: accessibilityGranted,
  };
};

export const askForMeetingPermission = async (
  type: 'microphone' | 'screen' | 'accessibility'
) => {
  if (!isMacOS()) {
    return false;
  }
  if (type === 'microphone') {
    return systemPreferences.askForMediaAccess(type);
  }
  if (type === 'accessibility') {
    // Shows a system dialog prompting user to open System Settings > Accessibility.
    // Returns current trust state (true if already trusted).
    return systemPreferences.isTrustedAccessibilityClient(true);
  }
  if (type === 'screen') {
    // On macOS 15+, system audio recording is triggered by creating a
    // process tap.  This fires the native "record your system audio" dialog.
    try {
      const nativeModule = await getNativeModuleAsync();
      const granted = nativeModule.requestSystemAudioPermission();
      if (granted) {
        confirmSystemAudioGranted();
      }
      return granted;
    } catch (error) {
      logger.error('Failed to request system audio permission', error);
      return false;
    }
  }
  return true;
};

/**
 * Reset macOS TCC permission for PolyMind back to `notDetermined`,
 * then re-trigger the native Allow / Don't Allow popup.
 *
 * Why this exists: once a user clicks "Don't Allow" on the native
 * permission prompt, macOS caches that as `denied` and refuses to
 * show the prompt again — every subsequent `askForMediaAccess` call
 * returns `false` immediately, no UI surfaced. Apple's intended
 * recovery path is for the user to flip the toggle in System
 * Settings → Privacy & Security manually.
 *
 * That's a confusing flow — the user clicks a button, expects a
 * prompt, sees nothing happen, and then has to navigate three menus
 * deep. So we offer a one-click alternative: `tccutil reset` for the
 * specific service+bundle pair (no sudo, current-user only) drops
 * the cached deny, and the next `askForMediaAccess` call surfaces the
 * native prompt fresh.
 *
 * Returns the granted state after the user makes a choice in the
 * re-shown prompt. `false` if reset failed (rare — usually a stale
 * binary that's no longer in TCC.db).
 */
export const resetAndAskMeetingPermission = async (
  type: 'microphone' | 'system-audio'
): Promise<boolean> => {
  if (!isMacOS()) {
    return false;
  }

  // tccutil service identifiers — verified empirically:
  //   `Microphone`    → mic capture
  //   `AudioCapture`  → the new audio-only system audio recording
  //                     entry (macOS 14.4+ via process taps).
  // We hardcode `pro.polymind.app` because that's our published
  // bundle ID — keeping it as a string avoids a roundtrip through
  // `app.getName()` which returns the user-facing name, not the
  // bundle ID.
  const serviceMap: Record<typeof type, string> = {
    microphone: 'Microphone',
    'system-audio': 'AudioCapture',
  };
  const service = serviceMap[type];
  const bundleId = 'pro.polymind.app';

  try {
    // tccutil exits non-zero if the bundle isn't registered in
    // TCC.db (i.e. the user never granted/denied — already in
    // `notDetermined` state). That's not an error from our point
    // of view, so we swallow non-zero exits and proceed to the
    // re-prompt regardless.
    execSync(`/usr/bin/tccutil reset ${service} ${bundleId}`, {
      stdio: 'ignore',
    });
  } catch (error) {
    // Don't bail on reset failure — the worst case is the user is
    // still in `denied` and the next ask returns false silently,
    // which is the same as before this function existed.
    logger.warn('tccutil reset failed (non-fatal)', { type, error });
  }

  if (type === 'microphone') {
    return systemPreferences.askForMediaAccess('microphone');
  }

  // system-audio → reset cached grant flag too, then trigger the
  // native process-tap prompt via the napi binding. The cache is
  // an in-memory mirror of TCC state so it has to track the reset
  // we just performed, otherwise startRecording would short-circuit
  // on the stale `true` the next time it's called.
  resetSystemAudioGranted();
  try {
    const nativeModule = await getNativeModuleAsync();
    const granted = nativeModule.requestSystemAudioPermission();
    if (granted) {
      confirmSystemAudioGranted();
    }
    return granted;
  } catch (error) {
    logger.error('Failed to re-request system audio permission', error);
    return false;
  }
};

export const checkCanRecordMeeting = () => {
  const features = checkMeetingPermissions();
  // Phase-8k: gate on ALL three permissions. Previously systemAudio
  // was deliberately excluded so the user could click Start before
  // it was granted — the native tap then surfaced its own dialog
  // mid-flight. That left a window where `meetingState` had already
  // flipped to `recording` while the audio engine was actually
  // waiting on the prompt; cancellation paths got messy. Cleaner
  // to require everything upfront and let the permission UI handle
  // the asks.
  return (
    checkRecordingAvailable() &&
    features &&
    features.microphone &&
    features.systemAudio &&
    features.accessibility
  );
};

// ---- Meeting history persistence ----

export interface MeetingHistoryRecord {
  id: number;
  docId: string;
  name: string;
  date: string;
  durationMs: number;
  audioFilePath: string;
  /**
   * Optional path to the parallel system-audio recording when the
   * meeting was captured in dual-track mode. The transcript was
   * generated by transcribing both this and `audioFilePath`
   * independently and merging by timestamp.
   */
  systemAudioFilePath?: string;
  segments: { time: string; text: string }[];
  createdAt: number;
}

// Storage lives in SQLite via `meetings-store.ts`. The exports below
// are thin async adapters preserving the original sync-ish API so
// IPC handlers in `index.ts` only had to add `await`. The legacy
// JSON blob (under the `meetingHistory:v1` key in
// `globalStateStorage`) is read once by meetings-store.ts during
// the first-run migration; nothing in this file accesses it any
// more.

export async function saveMeetingToHistory(
  record: MeetingHistoryRecord
): Promise<void> {
  const { saveMeetingToStore } = await import('./meetings-store');
  await saveMeetingToStore(record);
  logger.info('Meeting saved to history', { id: record.id, name: record.name });
}

export async function getMeetingHistoryFromStorage(
  docId?: string
): Promise<MeetingHistoryRecord[]> {
  const { listMeetingsFromStore } = await import('./meetings-store');
  return listMeetingsFromStore(docId);
}

export async function deleteMeetingFromHistory(id: number): Promise<void> {
  const { listMeetingsFromStore, deleteMeetingFromStore } = await import(
    './meetings-store'
  );
  // Read the record first so we know which audio file to clean up.
  // SQLite delete is idempotent — even if the row is gone, the
  // audio-file step still runs against whatever path we cached
  // here, which is correct for partial-failure recovery.
  const all = await listMeetingsFromStore();
  const meeting = all.find(m => m.id === id);

  await deleteMeetingFromStore(id);

  if (meeting?.audioFilePath) {
    deleteAudioFile(meeting.audioFilePath).catch(err => {
      logger.warn('Failed to delete audio file', {
        path: meeting.audioFilePath,
        err,
      });
    });
  }
  if (meeting?.systemAudioFilePath) {
    deleteAudioFile(meeting.systemAudioFilePath).catch(err => {
      logger.warn('Failed to delete system audio file', {
        path: meeting.systemAudioFilePath,
        err,
      });
    });
  }

  logger.info('Meeting deleted from history', { id });
}

/**
 * Deletes all meetings (records + audio files) belonging to a document.
 * Called when a document is permanently deleted to avoid orphaned data.
 */
export async function deleteMeetingsForDoc(docId: string): Promise<number> {
  const { listMeetingsFromStore, deleteMeetingsForDocFromStore } = await import(
    './meetings-store'
  );
  const toDelete = await listMeetingsFromStore(docId);

  if (toDelete.length === 0) return 0;

  await deleteMeetingsForDocFromStore(docId);

  // Delete audio files in parallel (best-effort — errors logged, not thrown)
  await Promise.all(
    toDelete.flatMap(m => {
      const tasks = [
        deleteAudioFile(m.audioFilePath).catch(err => {
          logger.warn('Failed to delete audio file for doc cascade', {
            path: m.audioFilePath,
            err,
          });
        }),
      ];
      // Dual-track recordings carry a parallel system-audio file
      // that needs the same cascade cleanup.
      if (m.systemAudioFilePath) {
        tasks.push(
          deleteAudioFile(m.systemAudioFilePath).catch(err => {
            logger.warn(
              'Failed to delete system audio file for doc cascade',
              {
                path: m.systemAudioFilePath,
                err,
              }
            );
          })
        );
      }
      return tasks;
    })
  );

  logger.info('Meetings deleted for doc', {
    docId,
    count: toDelete.length,
  });
  return toDelete.length;
}

async function deleteAudioFile(filepath: string) {
  const normalizedPath = await assertRecordingFilepath(filepath);
  await fsp.unlink(normalizedPath);
}

export async function exportAudioFile(audioFilePath: string) {
  const { dialog } = await import('electron');
  const normalizedPath = await assertRecordingFilepath(audioFilePath);
  const defaultName = path.basename(audioFilePath);

  const { canceled, filePath: savePath } = await dialog.showSaveDialog({
    title: 'Export Meeting Recording',
    defaultPath: defaultName,
    filters: [{ name: 'Audio Files', extensions: ['opus', 'ogg'] }],
  });

  if (canceled || !savePath) return null;

  await fsp.copyFile(normalizedPath, savePath);
  logger.info('Audio exported', { from: normalizedPath, to: savePath });
  return savePath;
}

