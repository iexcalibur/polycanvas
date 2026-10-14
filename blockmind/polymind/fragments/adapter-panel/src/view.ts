import { ViewExtensionProvider } from '@blockmind/polymind-ext-loader';

import { effects } from './effects';

export class AdapterPanelViewExtension extends ViewExtensionProvider {
  override name = 'polymind-adapter-panel-fragment';

  override effect() {
    super.effect();
    effects();
  }
}
