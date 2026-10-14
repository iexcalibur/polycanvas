import type { BlobEngine } from '@blockmind/polymind/sync';
import { DebugLogger } from '@polycanvas/debug';
import { apis, events } from '@polycanvas/electron-api';
import type { FrameworkProvider } from '@toeverything/infra';

import { getCurrentWorkspace } from './utils';

const logger = new DebugLogger('electron-renderer:recording');
const RECORDING_IMPORT_RETRY_MS = 1000;
const NATIVE_RECORDING_MIME_TYPE = 'audio/ogg';

type RecordingImportStatus = {
  id: number;
  appName?: string;
  workspaceId?: string;
  docId?: string;
  filepath: string;
  startTime: number;
  sampleRate?: number;
  numberOfChannels?: number;
  durationMs?: number;
  size?: number;
  degraded?: boolean;
  overflowCount?: number;
  errorMessage?: string;
  importStatus: 'pending_import' | 'importing' | 'imported' | 'import_failed';
  createdAt: number;
  updatedAt: number;
};

type WorkspaceHandle = NonNullable<ReturnType<typeof getCurrentWorkspace>>;

async function readRecordingFile(filepath: string) {
  if (apis?.recording?.readRecordingFile) {
    try {
      return await apis.recording.readRecordingFile(filepath);
    } catch (error) {
      logger.error(
        'Failed to read recording file via IPC, fallback to fetch',
        error
      );
    }
  }

  const fileUrl = new URL(
    filepath,
    typeof location !== 'undefined' && location.protocol === 'assets:'
      ? 'assets://local-file'
      : location.origin
  );
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch recording file: ${response.status} ${response.statusText}`
    );
  }
  return response.arrayBuffer();
}

async function saveRecordingBlob(blobEngine: BlobEngine, filepath: string) {
  logger.debug('Saving recording', filepath);
  const opusBuffer = await readRecordingFile(filepath);
  const blob = new Blob([opusBuffer], {
    type: NATIVE_RECORDING_MIME_TYPE,
  });
  const blobId = await blobEngine.set(blob);
  logger.debug('Recording saved', blobId);
  return { blob, blobId };
}

async function createRecordingDoc(
  frameworkProvider: FrameworkProvider,
  workspace: WorkspaceHandle['workspace'],
  status: RecordingImportStatus
) {
  // Save audio blob to workspace storage for sidebar playback.
  // No visible block is created in the document — transcription
  // and summary are handled entirely by the sidebar panel.
  await saveRecordingBlob(
    workspace.docCollection.blobSync,
    status.filepath
  );
}

export function setupRecordingEvents(frameworkProvider: FrameworkProvider) {
  let importQueue: RecordingImportStatus[] = [];
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let isProcessingImport = false;
  let hasSeenLiveQueueUpdate = false;

  const clearRetry = () => {
    if (retryTimer !== null) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  };

  const updateQueue = (nextQueue: RecordingImportStatus[]) => {
    importQueue = nextQueue;
  };

  const scheduleRetry = () => {
    if (importQueue.length === 0 || retryTimer !== null) {
      return;
    }
    retryTimer = setTimeout(() => {
      retryTimer = null;
      void processNextImport().catch(console.error);
    }, RECORDING_IMPORT_RETRY_MS);
  };

  const processNextImport = async () => {
    if (isProcessingImport) {
      return;
    }

    isProcessingImport = true;
    try {
      let isActiveTab = false;
      try {
        isActiveTab = !!(await apis?.ui.isActiveTab());
      } catch (error) {
        logger.error('Failed to probe active recording tab', error);
        return;
      }

      if (!isActiveTab) {
        return;
      }

      using currentWorkspace = getCurrentWorkspace(frameworkProvider);
      if (!currentWorkspace) {
        return;
      }

      const workspaceId = currentWorkspace.workspace.id;
      const nextStatus =
        importQueue.find(
          status =>
            status.importStatus === 'pending_import' &&
            (!status.workspaceId || status.workspaceId === workspaceId)
        ) ??
        importQueue.find(
          status =>
            status.importStatus === 'importing' &&
            status.workspaceId === workspaceId
        ) ??
        null;

      if (!nextStatus) {
        return;
      }

      const claimed = await apis?.recording.claimRecordingImport(
        nextStatus.id,
        workspaceId
      );
      if (!claimed) {
        return;
      }

      try {
        await createRecordingDoc(
          frameworkProvider,
          currentWorkspace.workspace,
          claimed
        );
      } catch (error) {
        const importError =
          error instanceof Error
            ? error
            : new Error('Failed to import recording artifact');
        logger.error('Failed to import recording artifact', importError);
        await apis?.recording.failRecordingImport(
          nextStatus.id,
          importError.message
        );
        return;
      }

      try {
        await apis?.recording.completeRecordingImport(nextStatus.id);
      } catch (error) {
        const completionError =
          error instanceof Error
            ? error
            : new Error('Failed to persist recording import completion');
        logger.error(
          'Failed to persist recording import completion',
          completionError
        );
        await apis?.recording.failRecordingImport(
          nextStatus.id,
          completionError.message
        );
      }
    } finally {
      isProcessingImport = false;
      scheduleRetry();
    }
  };

  if (apis?.recording) {
    void apis.recording
      .getRecordingImportQueue()
      .then(queue => {
        if (hasSeenLiveQueueUpdate) {
          return;
        }
        updateQueue(queue ?? []);
        void processNextImport().catch(console.error);
      })
      .catch(error => {
        logger.error('Failed to load recording import queue', error);
      });
  }

  events?.recording.onRecordingImportQueueChanged(queue => {
    hasSeenLiveQueueUpdate = true;
    updateQueue(queue);
    clearRetry();
    void processNextImport().catch(console.error);
  });
}
