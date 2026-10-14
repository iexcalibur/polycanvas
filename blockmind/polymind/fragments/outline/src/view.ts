import { ViewExtensionProvider } from '@blockmind/polymind-ext-loader';

import { effects } from './effects';

export class OutlineViewExtension extends ViewExtensionProvider {
  override name = 'polymind-outline-fragment';

  override effect() {
    super.effect();
    effects();
  }
}
