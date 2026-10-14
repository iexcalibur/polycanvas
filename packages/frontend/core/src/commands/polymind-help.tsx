import type { useI18n } from '@polycanvas/i18n';
import { ContactWithUsIcon, NewIcon } from '@blocksuite/icons/rc';

import type { WorkspaceDialogService } from '../modules/dialogs';
import type { UrlService } from '../modules/url';
import { registerPolymindCommand } from './registry';

export function registerPolymindHelpCommands({
  t,
  urlService,
  workspaceDialogService,
}: {
  t: ReturnType<typeof useI18n>;
  urlService: UrlService;
  workspaceDialogService: WorkspaceDialogService;
}) {
  const unsubs: Array<() => void> = [];
  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:help-whats-new',
      category: 'polymind:help',
      icon: <NewIcon />,
      label: t['com.polymind.cmdk.polymind.whats-new'](),
      run() {
        urlService.openPopupWindow(BUILD_CONFIG.changelogUrl);
      },
    })
  );
  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:help-contact-us',
      category: 'polymind:help',
      icon: <ContactWithUsIcon />,
      label: t['com.polymind.cmdk.polymind.contact-us'](),
      run() {
        workspaceDialogService.open('setting', {
          activeTab: 'about',
        });
      },
    })
  );

  return () => {
    unsubs.forEach(unsub => unsub());
  };
}
