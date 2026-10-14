import { ViewExtensionProvider } from '@blockmind/polymind-ext-loader';

import { effects } from './effects';

export class DocTitleViewExtension extends ViewExtensionProvider {
  override name = 'polymind-doc-title-fragment';

  override effect() {
    super.effect();
    effects();
  }
}
