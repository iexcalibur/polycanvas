import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blockmind/polymind-ext-loader';

import { frameTitleWidget } from './polymind-frame-title-widget';
import { effects } from './effects';

export class FrameTitleViewExtension extends ViewExtensionProvider {
  override name = 'polymind-frame-title-widget';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (context.scope === 'edgeless') {
      context.register(frameTitleWidget);
    }
  }
}
