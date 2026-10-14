import {
  type StoreExtensionContext,
  StoreExtensionProvider,
} from '@blockmind/polymind-ext-loader';
import { BookmarkBlockSchemaExtension } from '@blockmind/polymind-model';

import { BookmarkBlockAdapterExtensions } from './adapters/extension';

export class BookmarkStoreExtension extends StoreExtensionProvider {
  override name = 'polymind-bookmark-block';

  override setup(context: StoreExtensionContext) {
    super.setup(context);
    context.register(BookmarkBlockSchemaExtension);
    context.register(BookmarkBlockAdapterExtensions);
  }
}
