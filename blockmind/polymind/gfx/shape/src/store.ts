import {
  type StoreExtensionContext,
  StoreExtensionProvider,
} from '@blockmind/polymind-ext-loader';

import {
  shapeToMarkdownAdapterMatcher,
  shapeToPlainTextAdapterMatcher,
} from './adapter';

export class ShapeStoreExtension extends StoreExtensionProvider {
  override name = 'polymind-shape-gfx';

  override setup(context: StoreExtensionContext) {
    super.setup(context);
    context.register(shapeToMarkdownAdapterMatcher);
    context.register(shapeToPlainTextAdapterMatcher);
  }
}
