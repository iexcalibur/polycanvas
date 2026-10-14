import { MenuItem } from '@polycanvas/component';
import { WorkspaceDialogService } from '@polycanvas/core/modules/dialogs';
import { useI18n } from '@polycanvas/i18n';
import { AccountIcon, SignOutIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useCallback } from 'react';

import { useSignOut } from '../../hooks/polymind/use-sign-out';

export const AccountMenu = () => {
  const workspaceDialogService = useService(WorkspaceDialogService);
  const openSignOutModal = useSignOut();

  const onOpenAccountSetting = useCallback(() => {
    workspaceDialogService.open('setting', {
      activeTab: 'account',
    });
  }, [workspaceDialogService]);

  const t = useI18n();

  return (
    <>
      <MenuItem
        prefixIcon={<AccountIcon />}
        data-testid="workspace-modal-account-settings-option"
        onClick={onOpenAccountSetting}
      >
        {t['com.polymind.workspace.cloud.account.settings']()}
      </MenuItem>
      <MenuItem
        prefixIcon={<SignOutIcon />}
        data-testid="workspace-modal-sign-out-option"
        onClick={openSignOutModal}
      >
        {t['com.polymind.workspace.cloud.account.logout']()}
      </MenuItem>
    </>
  );
};
