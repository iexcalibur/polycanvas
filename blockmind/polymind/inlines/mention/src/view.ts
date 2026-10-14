import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blockmind/polymind-ext-loader';

import { effects } from './effects';
import { MentionInlineSpecExtension } from './inline-spec';

export class MentionViewExtension extends ViewExtensionProvider {
  override name = 'polymind-mention-inline';

  override effect(): void {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext): void {
    super.setup(context);
    context.register(MentionInlineSpecExtension);
  }
}
