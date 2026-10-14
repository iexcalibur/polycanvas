import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blockmind/polymind-ext-loader';

import { effects } from './effects';
import { scrollAnchoringWidget } from './index';

export class ScrollAnchoringViewExtension extends ViewExtensionProvider {
  override name = 'polymind-scroll-anchoring-widget';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(scrollAnchoringWidget);
  }
}
