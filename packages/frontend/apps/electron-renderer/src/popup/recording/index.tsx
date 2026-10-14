import { Button } from '@polycanvas/component';
import { useAsyncCallback } from '@polycanvas/core/components/hooks/polymind-async-hooks';
import { appIconMap } from '@polycanvas/core/utils';
import { apis, events } from '@polycanvas/electron-api';
import { useI18n } from '@polycanvas/i18n';
import { useEffect, useMemo, useState } from 'react';

import * as styles from './styles.css';

type Status = {
  id: number;
  status:
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
  appName?: string;
  appGroupId?: number;
  icon?: Buffer;
  filepath?: string;
  sampleRate?: number;
  numberOfChannels?: number;
};

export const useRecordingStatus = () => {
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    // Get initial status
    apis?.recording
      .getCurrentRecording()
      .then(status => setStatus(status satisfies Status | null))
      .catch(console.error);

    // Subscribe to status changes
    const unsubscribe = events?.recording.onRecordingStatusChanged(status =>
      setStatus(status satisfies Status | null)
    );

    return () => {
      unsubscribe?.();
    };
  }, []);

  return status;
};

const appIcon = appIconMap[BUILD_CONFIG.appBuildType];

export function Recording() {
  const status = useRecordingStatus();
  const t = useI18n();
  const textElement = useMemo(() => {
    if (!status) {
      return null;
    }
    if (status.status === 'new') {
      return t['com.polymind.recording.new']();
    } else if (status.status === 'imported') {
      return t['com.polymind.recording.success.prompt']();
    } else if (
      status.status === 'import_failed' ||
      status.status === 'start_failed' ||
      status.status === 'finalize_failed'
    ) {
      return t['com.polymind.recording.failed.prompt']();
    } else if (
      status.status === 'starting' ||
      status.status === 'recording' ||
      status.status === 'finalizing'
    ) {
      if (status.appName) {
        return t['com.polymind.recording.recording']({
          appName: status.appName,
        });
      } else {
        return t['com.polymind.recording.recording.unnamed']();
      }
    } else if (
      status.status === 'pending_import' ||
      status.status === 'importing'
    ) {
      return t['com.polymind.recording.importing.prompt']();
    }
    return null;
  }, [status, t]);

  const handleDismiss = useAsyncCallback(async () => {
    if (status) {
      await apis?.recording?.dismissRecordingStatus(status.id);
    }
    await apis?.popup?.dismissCurrentRecording();
  }, [status]);

  const handleStopRecording = useAsyncCallback(async () => {
    if (!status) {
      return;
    }
    await apis?.recording?.stopRecording(status.id);
  }, [status]);

  const handleStartRecording = useAsyncCallback(async () => {
    if (!status) {
      return;
    }
    await apis?.recording?.startRecording(status.appGroupId);
  }, [status]);

  const handleOpenFile = useAsyncCallback(async () => {
    if (!status) {
      return;
    }
    await apis?.recording?.showSavedRecordings(status.filepath);
  }, [status]);

  const controlsElement = useMemo(() => {
    if (!status) {
      return null;
    }
    if (status.status === 'new') {
      return (
        <>
          <Button variant="plain" onClick={handleDismiss}>
            {t['com.polymind.recording.dismiss']()}
          </Button>
          <Button
            onClick={handleStartRecording}
            variant="primary"
            prefix={<div className={styles.recordingIcon} />}
          >
            {t['com.polymind.recording.start']()}
          </Button>
        </>
      );
    } else if (status.status === 'recording') {
      return (
        <Button variant="error" onClick={handleStopRecording}>
          {t['com.polymind.recording.stop']()}
        </Button>
      );
    } else if (
      status.status === 'starting' ||
      status.status === 'finalizing' ||
      status.status === 'pending_import' ||
      status.status === 'importing'
    ) {
      return (
        <Button
          variant="error"
          onClick={handleDismiss}
          loading={true}
          disabled
        />
      );
    } else if (status.status === 'imported') {
      return (
        <Button variant="primary" onClick={handleDismiss}>
          {t['com.polymind.recording.success.button']()}
        </Button>
      );
    } else if (status.status === 'start_failed') {
      return (
        <Button variant="plain" onClick={handleDismiss}>
          {t['com.polymind.recording.dismiss']()}
        </Button>
      );
    } else if (
      status.status === 'import_failed' ||
      status.status === 'finalize_failed'
    ) {
      return (
        <>
          <Button variant="plain" onClick={handleDismiss}>
            {t['com.polymind.recording.dismiss']()}
          </Button>
          <Button variant="error" onClick={handleOpenFile}>
            {t['com.polymind.recording.failed.button']()}
          </Button>
        </>
      );
    }
    return null;
  }, [
    handleDismiss,
    handleOpenFile,
    handleStartRecording,
    handleStopRecording,
    status,
    t,
  ]);

  if (!status) {
    return null;
  }

  return (
    <div className={styles.root}>
      <img className={styles.polymindIcon} src={appIcon} alt="PolyMind" />
      <div className={styles.text}>{textElement}</div>
      <div className={styles.controls}>{controlsElement}</div>
    </div>
  );
}
