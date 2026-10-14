import { createEmbedBlockPlainTextAdapterMatcher } from '@blockmind/polymind-block-embed';
import { BookmarkBlockSchema } from '@blockmind/polymind-model';
import { BlockPlainTextAdapterExtension } from '@blockmind/polymind-shared/adapters';

export const bookmarkBlockPlainTextAdapterMatcher =
  createEmbedBlockPlainTextAdapterMatcher(BookmarkBlockSchema.model.flavour);

export const BookmarkBlockPlainTextAdapterExtension =
  BlockPlainTextAdapterExtension(bookmarkBlockPlainTextAdapterMatcher);
