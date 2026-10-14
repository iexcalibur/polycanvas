import {
  SettingHeader,
  SettingRow,
  SettingWrapper,
} from '@polycanvas/component/setting-components';
import { useWorkspaceInfo } from '@polycanvas/core/components/hooks/use-workspace-info';
import { WorkspaceService } from '@polycanvas/core/modules/workspace';
import { UNTITLED_WORKSPACE_NAME } from '@polycanvas/env/constant';
import { useI18n } from '@polycanvas/i18n';
import { ArrowRightSmallIcon } from '@blocksuite/icons/rc';
import { FrameworkScope, useService } from '@toeverything/infra';
import { useCallback } from 'react';

import { DeleteLeaveWorkspace } from './delete-leave-workspace';
import { EnableCloudPanel } from './enable-cloud';
import { LabelsPanel } from './labels';
import { ProfilePanel } from './profile';
import { SharingPanel } from './sharing';
import type { WorkspaceSettingDetailProps } from './types';

export const WorkspaceSettingDetail = ({
  onCloseSetting,
}: WorkspaceSettingDetailProps) => {
  const t = useI18n();

  const workspace = useService(WorkspaceService).workspace;
  const server = undefined as any;

  const workspaceInfo = useWorkspaceInfo(workspace);

  const handleResetSyncStatus = useCallback(() => {
    workspace?.engine.doc
      .resetSync()
      .then(() => {
        onCloseSetting();
      })
      .catch(err => {
        console.error(err);
      });
  }, [onCloseSetting, workspace]);

  return (
    <FrameworkScope scope={server?.scope}>
      <SettingHeader
        title={t[`Workspace Settings with name`]({
          name: workspaceInfo?.name ?? UNTITLED_WORKSPACE_NAME,
        })}
        subtitle={t['com.polymind.settings.workspace.description']()}
      />
      <SettingWrapper title={t['Info']()}>
        <SettingRow
          name={t['Workspace Profile']()}
          desc={t['com.polymind.settings.workspace.not-owner']()}
          spreadCol={false}
        >
          <ProfilePanel />
          <LabelsPanel />
          {workspace.flavour === 'local' && (
            <EnableCloudPanel onCloseSetting={onCloseSetting} />
          )}
        </SettingRow>
      </SettingWrapper>
      <SharingPanel />
      <SettingWrapper>
        <DeleteLeaveWorkspace onCloseSetting={onCloseSetting} />
        <SettingRow
          name={
            <span style={{ color: 'var(--polymind-text-secondary-color)' }}>
              {t['com.polymind.resetSyncStatus.button']()}
            </span>
          }
          desc={t['com.polymind.resetSyncStatus.description']()}
          style={{ cursor: 'pointer' }}
          onClick={handleResetSyncStatus}
          data-testid="reset-sync-status"
        >
          <ArrowRightSmallIcon />
        </SettingRow>
      </SettingWrapper>
    </FrameworkScope>
  );
};
