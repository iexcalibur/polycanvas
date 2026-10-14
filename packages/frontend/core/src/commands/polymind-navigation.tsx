import type { useI18n } from '@polycanvas/i18n';
import type { Workspace } from '@blockmind/polymind/store';
import { ArrowRightBigIcon } from '@blocksuite/icons/rc';

import type { useNavigateHelper } from '../components/hooks/use-navigate-helper';
import type { WorkspaceDialogService } from '../modules/dialogs';
import type { WorkbenchService } from '../modules/workbench';
import { registerPolymindCommand } from './registry';

export function registerPolymindNavigationCommands({
  t,
  docCollection,
  navigationHelper,
  workspaceDialogService,
  workbenchService,
}: {
  t: ReturnType<typeof useI18n>;
  navigationHelper: ReturnType<typeof useNavigateHelper>;
  docCollection: Workspace;
  workspaceDialogService: WorkspaceDialogService;
  workbenchService?: WorkbenchService;
}) {
  const unsubs: Array<() => void> = [];
  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:goto-all-pages',
      category: 'polymind:navigation',
      icon: <ArrowRightBigIcon />,
      label: t['com.polymind.cmdk.polymind.navigation.goto-all-pages'](),
      run() {
        navigationHelper.jumpToPage(docCollection.id, 'all');
      },
    })
  );

  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:goto-collection-list',
      category: 'polymind:navigation',
      icon: <ArrowRightBigIcon />,
      label: 'Go to Collection List',
      run() {
        navigationHelper.jumpToCollections(docCollection.id);
      },
    })
  );

  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:goto-tag-list',
      category: 'polymind:navigation',
      icon: <ArrowRightBigIcon />,
      label: 'Go to Tag List',
      run() {
        navigationHelper.jumpToTags(docCollection.id);
      },
    })
  );

  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:goto-workspace',
      category: 'polymind:navigation',
      icon: <ArrowRightBigIcon />,
      label: t['com.polymind.cmdk.polymind.navigation.goto-workspace'](),
      run() {
        workbenchService?.workbench.openWorkspaceSelector();
      },
    })
  );

  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:open-settings',
      category: 'polymind:navigation',
      icon: <ArrowRightBigIcon />,
      label: t['com.polymind.cmdk.polymind.navigation.open-settings'](),
      keyBinding: '$mod+,',
      run() {
        workspaceDialogService.open('setting', {
          activeTab: 'appearance',
        });
      },
    })
  );

  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:open-account',
      category: 'polymind:navigation',
      icon: <ArrowRightBigIcon />,
      label: t['com.polymind.cmdk.polymind.navigation.open-account-settings'](),
      run() {
        workspaceDialogService.open('setting', {
          activeTab: 'account',
        });
      },
    })
  );

  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:goto-trash',
      category: 'polymind:navigation',
      icon: <ArrowRightBigIcon />,
      label: t['com.polymind.cmdk.polymind.navigation.goto-trash'](),
      run() {
        navigationHelper.jumpToPage(docCollection.id, 'trash');
      },
    })
  );

  return () => {
    unsubs.forEach(unsub => unsub());
  };
}
