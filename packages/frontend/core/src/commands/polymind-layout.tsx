import type { useI18n } from '@polycanvas/i18n';
import { SidebarIcon } from '@blocksuite/icons/rc';

import type { AppSidebarService } from '../modules/app-sidebar';
import { registerPolymindCommand } from './registry';

export function registerPolymindLayoutCommands({
  t,
  appSidebarService,
}: {
  t: ReturnType<typeof useI18n>;
  appSidebarService: AppSidebarService;
}) {
  const unsubs: Array<() => void> = [];
  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:toggle-left-sidebar',
      category: 'polymind:layout',
      icon: <SidebarIcon />,
      label: () =>
        appSidebarService.sidebar.open$.value
          ? t['com.polymind.cmdk.polymind.left-sidebar.collapse']()
          : t['com.polymind.cmdk.polymind.left-sidebar.expand'](),

      keyBinding: {
        binding: '$mod+/',
      },
      run() {
        appSidebarService.sidebar.toggleSidebar();
      },
    })
  );

  return () => {
    unsubs.forEach(unsub => unsub());
  };
}
