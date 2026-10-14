import { type ExtensionType } from '@blockmind/polymind/store';
import type { FrameworkProvider } from '@toeverything/infra';

import { IconPickerService } from '../../../modules/icon-picker/services/icon-picker';

/**
 * Patch the icon picker service to make it available in BlockMind
 */
export function patchIconPickerService(
  _framework: FrameworkProvider
): ExtensionType {
  return {
    setup: () => {
      // IconPickerServiceIdentifier not available in current blockmind version
      // Service will be available once blockmind adds this export
    },
  };
}
