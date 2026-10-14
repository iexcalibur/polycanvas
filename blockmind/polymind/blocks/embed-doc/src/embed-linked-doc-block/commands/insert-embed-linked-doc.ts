import { insertEmbedCard } from '@blockmind/polymind-block-embed';
import type { EmbedCardStyle, ReferenceParams } from '@blockmind/polymind-model';
import type { Command } from '@blockmind/std';

export type LinkableFlavour =
  | 'polymind:bookmark'
  | 'polymind:embed-linked-doc'
  | 'polymind:embed-synced-doc'
  | 'polymind:embed-iframe'
  | 'polymind:embed-figma'
  | 'polymind:embed-github'
  | 'polymind:embed-loom'
  | 'polymind:embed-youtube';

export type InsertedLinkType = {
  flavour: LinkableFlavour;
} | null;

export const insertEmbedLinkedDocCommand: Command<
  {
    docId: string;
    params?: ReferenceParams;
  },
  { blockId: string }
> = (ctx, next) => {
  const { docId, params, std } = ctx;
  const flavour = 'polymind:embed-linked-doc';
  const targetStyle: EmbedCardStyle = 'vertical';
  const props: Record<string, unknown> = { pageId: docId };
  if (params) props.params = params;
  const blockId = insertEmbedCard(std, { flavour, targetStyle, props });
  if (!blockId) return;
  next({ blockId });
};
