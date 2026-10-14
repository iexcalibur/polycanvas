import {
  POLYMIND_FLAGS,
  type FeatureFlagService,
} from '@polycanvas/core/modules/feature-flag';
import { FeatureFlagService as BSFeatureFlagService } from '@blockmind/polymind/shared/services';
import { type ExtensionType, StoreExtension } from '@blockmind/polymind/store';

export function getFeatureFlagSyncer(
  featureFlagService: FeatureFlagService
): ExtensionType {
  class FeatureFlagSyncer extends StoreExtension {
    static override key = 'feature-flag-syncer';

    override loaded() {
      const bsFeatureFlagService = this.store.get(BSFeatureFlagService);
      Object.entries(POLYMIND_FLAGS).forEach(([key, flag]) => {
        if (flag.category === 'blocksuite') {
          const value =
            featureFlagService.flags[key as keyof POLYMIND_FLAGS].value;
          if (value !== undefined) {
            bsFeatureFlagService.setFlag(flag.bsFlag, value);
          }
        }
      });
    }
  }

  return FeatureFlagSyncer;
}
