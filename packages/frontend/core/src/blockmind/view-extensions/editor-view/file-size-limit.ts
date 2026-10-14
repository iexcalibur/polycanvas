import { WorkspaceDialogService } from '@polycanvas/core/modules/dialogs';
import type { Container } from '@blockmind/polymind/global/di';
import {
  FileSizeLimitProvider,
  type IFileSizeLimitService,
} from '@blockmind/polymind/shared/services';
import { Extension } from '@blockmind/polymind/store';
import type { FrameworkProvider } from '@toeverything/infra';

export function patchFileSizeLimitExtension(framework: FrameworkProvider) {
  const workspaceDialogService = framework.get(WorkspaceDialogService);

  class PolymindFileSizeLimitService
    extends Extension
    implements IFileSizeLimitService
  {
    // 2GB
    maxFileSize = 2 * 1024 * 1024 * 1024;

    onOverFileSize() {
      workspaceDialogService.open('setting', {
        activeTab: 'plans',
        scrollAnchor: 'cloudPricingPlan',
      });
    }

    static override setup(di: Container) {
      di.override(FileSizeLimitProvider, PolymindFileSizeLimitService);
    }
  }

  return PolymindFileSizeLimitService;
}
