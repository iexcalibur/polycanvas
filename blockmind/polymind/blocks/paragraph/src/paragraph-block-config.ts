import type { ParagraphBlockModel } from '@blockmind/polymind-model';
import { ConfigExtensionFactory } from '@blockmind/std';

export interface ParagraphBlockConfig {
  getPlaceholder: (model: ParagraphBlockModel) => string;
}

export const ParagraphBlockConfigExtension =
  ConfigExtensionFactory<ParagraphBlockConfig>('polymind:paragraph');
