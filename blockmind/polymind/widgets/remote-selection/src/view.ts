import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blockmind/polymind-ext-loader';

import { effects } from './effects';
import {
  docRemoteSelectionWidget,
  edgelessRemoteSelectionWidget,
} from './index';

export class RemoteSelectionViewExtension extends ViewExtensionProvider {
  override name = 'polymind-remote-selection-widget';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(docRemoteSelectionWidget);
    if (context.scope === 'edgeless') {
      context.register(edgelessRemoteSelectionWidget);
    }
  }
}
