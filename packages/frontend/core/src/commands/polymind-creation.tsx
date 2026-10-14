import type { useI18n } from '@polycanvas/i18n';
import type { DocMode } from '@blockmind/polymind/model';
import { ImportIcon, PlusIcon } from '@blocksuite/icons/rc';

import type { usePageHelper } from '../blockmind/block-suite-page-list/utils';
import type { GlobalDialogService } from '../modules/dialogs';
import { registerPolymindCommand } from './registry';

export function registerPolymindCreationCommands({
  pageHelper,
  t,
  globalDialogService,
}: {
  t: ReturnType<typeof useI18n>;
  pageHelper: ReturnType<typeof usePageHelper>;
  globalDialogService: GlobalDialogService;
}) {
  const unsubs: Array<() => void> = [];
  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:new-page',
      category: 'polymind:creation',
      label: t['com.polymind.cmdk.polymind.new-page'](),
      icon: <PlusIcon />,
      keyBinding: BUILD_CONFIG.isElectron
        ? {
            binding: '$mod+N',
            skipRegister: true,
          }
        : undefined,
      run() {
        pageHelper.createPage('page' as DocMode);
      },
    })
  );

  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:new-edgeless-page',
      category: 'polymind:creation',
      icon: <PlusIcon />,
      label: t['com.polymind.cmdk.polymind.new-edgeless-page'](),
      run() {
        pageHelper.createEdgeless();
      },
    })
  );

  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:new-workspace',
      category: 'polymind:creation',
      icon: <PlusIcon />,
      label: t['com.polymind.cmdk.polymind.new-workspace'](),
      run() {
        globalDialogService.open('create-workspace', {});
      },
    })
  );
  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:import-workspace',
      category: 'polymind:creation',
      icon: <ImportIcon />,
      label: t['com.polymind.cmdk.polymind.import-workspace'](),
      preconditionStrategy: () => {
        return BUILD_CONFIG.isElectron;
      },
      run() {
        globalDialogService.open('import-workspace', undefined);
      },
    })
  );

  return () => {
    unsubs.forEach(unsub => unsub());
  };
}
