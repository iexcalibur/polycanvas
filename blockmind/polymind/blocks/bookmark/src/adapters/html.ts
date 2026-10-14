import { createEmbedBlockHtmlAdapterMatcher } from '@blockmind/polymind-block-embed';
import { BookmarkBlockSchema } from '@blockmind/polymind-model';
import { BlockHtmlAdapterExtension } from '@blockmind/polymind-shared/adapters';

export const bookmarkBlockHtmlAdapterMatcher =
  createEmbedBlockHtmlAdapterMatcher(BookmarkBlockSchema.model.flavour);

export const BookmarkBlockHtmlAdapterExtension = BlockHtmlAdapterExtension(
  bookmarkBlockHtmlAdapterMatcher
);
