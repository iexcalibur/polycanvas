import { ScrollableContainer } from '@polycanvas/component';
import { GlobalDialogService } from '@polycanvas/core/modules/dialogs';
import { type WorkspaceMetadata } from '@polycanvas/core/modules/workspace';
import { useService } from '@toeverything/infra';
import { useCallback } from 'react';

import { AddWorkspace } from './add-workspace';
import * as styles from './index.css';
import { AllWorkspaceList } from './workspace-list';

interface UserWithWorkspaceListProps {
  onEventEnd?: () => void;
  onClickWorkspace?: (workspace: WorkspaceMetadata) => void;
  onCreatedWorkspace?: (payload: {
    metadata: WorkspaceMetadata;
    defaultDocId?: string;
  }) => void;
  showEnableCloudButton?: boolean;
}

export const UserWithWorkspaceList = ({
  onEventEnd,
  onClickWorkspace,
  onCreatedWorkspace,
  showEnableCloudButton,
}: UserWithWorkspaceListProps) => {
  const globalDialogService = useService(GlobalDialogService);

  const onNewWorkspace = useCallback(() => {
    globalDialogService.open('create-workspace', {}, payload => {
      if (payload) {
        onCreatedWorkspace?.(payload);
      }
    });
    onEventEnd?.();
  }, [globalDialogService, onCreatedWorkspace, onEventEnd]);

  const onAddWorkspace = useCallback(() => {
    globalDialogService.open('import-workspace', undefined, payload => {
      if (payload) {
        onCreatedWorkspace?.({ metadata: payload.workspace });
      }
    });
    onEventEnd?.();
  }, [globalDialogService, onCreatedWorkspace, onEventEnd]);

  return (
    <>
      <ScrollableContainer
        className={styles.workspaceScrollArea}
        viewPortClassName={styles.workspaceScrollAreaViewport}
        scrollBarClassName={styles.scrollbar}
        scrollThumbClassName={styles.scrollbarThumb}
      >
        <AllWorkspaceList
          onEventEnd={onEventEnd}
          onClickWorkspace={onClickWorkspace}
          showEnableCloudButton={showEnableCloudButton}
        />
      </ScrollableContainer>
      <div className={styles.workspaceFooter}>
        <AddWorkspace
          onAddWorkspace={onAddWorkspace}
          onNewWorkspace={onNewWorkspace}
        />
      </div>
    </>
  );
};
