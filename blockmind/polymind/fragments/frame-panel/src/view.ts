import { ViewExtensionProvider } from '@blockmind/polymind-ext-loader';

import { effects } from './effects';

export class FramePanelViewExtension extends ViewExtensionProvider {
  override name = 'polymind-frame-panel-fragment';

  override effect() {
    super.effect();
    effects();
  }
}
