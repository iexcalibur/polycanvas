import type { ExtensionType } from '@blockmind/store';

import { EmbedLinkedDocHtmlAdapterExtension } from './html.js';
import { EmbedLinkedDocMarkdownAdapterExtension } from './markdown.js';
import { EmbedLinkedDocBlockPlainTextAdapterExtension } from './plain-text.js';

export const EmbedLinkedDocBlockAdapterExtensions: ExtensionType[] = [
  EmbedLinkedDocHtmlAdapterExtension,
  EmbedLinkedDocMarkdownAdapterExtension,
  EmbedLinkedDocBlockPlainTextAdapterExtension,
];
