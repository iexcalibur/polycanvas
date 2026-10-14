import { notify } from '@polycanvas/component';
import { updateReadyAtom } from '@polycanvas/core/components/hooks/use-app-updater';
import type { useI18n } from '@polycanvas/i18n';
import { ResetIcon } from '@blocksuite/icons/rc';
import type { createStore } from 'jotai';

import { registerPolymindCommand } from './registry';

export function registerPolymindUpdatesCommands({
  t,
  store,
  quitAndInstall,
}: {
  t: ReturnType<typeof useI18n>;
  store: ReturnType<typeof createStore>;
  quitAndInstall: () => Promise<void>;
}) {
  const unsubs: Array<() => void> = [];

  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:restart-to-upgrade',
      category: 'polymind:updates',
      icon: <ResetIcon />,
      label: t['com.polymind.cmdk.polymind.restart-to-upgrade'](),
      preconditionStrategy: () => !!store.get(updateReadyAtom),
      run() {
        quitAndInstall().catch(err => {
          notify.error({
            title: 'Failed to restart to upgrade',
            message: 'Please restart the app manually to upgrade.',
          });
          console.error(err);
        });
      },
    })
  );

  return () => {
    unsubs.forEach(unsub => unsub());
  };
}
