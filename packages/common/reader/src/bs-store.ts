import { StoreExtensionManager } from '@blockmind/polymind/ext-loader';
import { getInternalStoreExtensions } from '@blockmind/polymind/extensions/store';

const manager = new StoreExtensionManager(getInternalStoreExtensions());

export function getStoreManager() {
  return manager;
}
