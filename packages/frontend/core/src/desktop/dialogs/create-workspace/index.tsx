import { Button, ConfirmModal, notify, RowInput } from '@polycanvas/component';
import { useAsyncCallback } from '@polycanvas/core/components/hooks/polymind-async-hooks';
import {
  type DialogComponentProps,
  type GLOBAL_DIALOG_SCHEMA,
} from '@polycanvas/core/modules/dialogs';
import { WorkspacesService } from '@polycanvas/core/modules/workspace';
import { buildShowcaseWorkspace } from '@polycanvas/core/utils/first-app-data';
import { useI18n } from '@polycanvas/i18n';
import { useService } from '@toeverything/infra';
import { useCallback, useState } from 'react';

import * as styles from './index.css';

const FormSection = ({
  label,
  input,
}: {
  label: string;
  input: React.ReactNode;
}) => {
  return (
    <section className={styles.section}>
      <label className={styles.label}>{label}</label>
      {input}
    </section>
  );
};

export const CreateWorkspaceDialog = ({
  close,
  ...props
}: DialogComponentProps<GLOBAL_DIALOG_SCHEMA['create-workspace']>) => {
  const t = useI18n();

  const [workspaceName, setWorkspaceName] = useState('');

  const onOpenChange = useCallback(
    (open: boolean) => {
      if (!open) close();
    },
    [close]
  );

  return (
    <ConfirmModal
      open
      onOpenChange={onOpenChange}
      title={t['com.polymind.nameWorkspace.title']()}
      description={t['com.polymind.nameWorkspace.description']()}
      cancelText={t['com.polymind.nameWorkspace.button.cancel']()}
      closeButtonOptions={{
        ['data-testid' as string]: 'create-workspace-close-button',
      }}
      contentOptions={{}}
      childrenContentClassName={styles.content}
      customConfirmButton={() => {
        return (
          <LocalConfirmButton
            workspaceName={workspaceName}
            onCreated={res =>
              close({ metadata: res.meta, defaultDocId: res.defaultDocId })
            }
          />
        );
      }}
      {...props}
    >
      <FormSection
        label={t['com.polymind.nameWorkspace.subtitle.workspace-name']()}
        input={
          <RowInput
            autoFocus
            className={styles.input}
            data-testid="create-workspace-input"
            placeholder={t['com.polymind.nameWorkspace.placeholder']()}
            maxLength={64}
            minLength={0}
            onChange={setWorkspaceName}
          />
        }
      />
    </ConfirmModal>
  );
};

const LocalConfirmButton = ({
  workspaceName,
  onCreated,
}: {
  workspaceName: string;
  onCreated: (res: Awaited<ReturnType<typeof buildShowcaseWorkspace>>) => void;
}) => {
  const t = useI18n();
  const [loading, setLoading] = useState(false);

  const workspacesService = useService(WorkspacesService);

  const handleConfirm = useAsyncCallback(async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await buildShowcaseWorkspace(
        workspacesService,
        'local',
        workspaceName
      );
      onCreated(res);
    } catch (e) {
      console.error(e);
      notify.error({
        title: 'Failed to create workspace',
        message: 'please try again later.',
      });
    } finally {
      setLoading(false);
    }
  }, [loading, onCreated, workspaceName, workspacesService]);

  return (
    <Button
      disabled={!workspaceName}
      data-testid="create-workspace-create-button"
      variant="primary"
      onClick={handleConfirm}
      loading={loading}
    >
      {t['com.polymind.nameWorkspace.button.create']()}
    </Button>
  );
};
