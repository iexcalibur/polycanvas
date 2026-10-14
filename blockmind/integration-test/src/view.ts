import { ViewExtensionManager } from '@blockmind/polymind/ext-loader';
import { getInternalViewExtensions } from '@blockmind/polymind/extensions/view';

const manager = new ViewExtensionManager(getInternalViewExtensions());

export function getTestViewManager() {
  return manager;
}
