import { BlockSchemaExtension } from '../extension/schema.js';
import { BlockModel, defineBlockSchema } from '../model/index.js';

export const RootBlockSchema = defineBlockSchema({
  flavour: 'polymind:page',
  props: internal => ({
    title: internal.Text(),
    count: 0,
    style: {} as Record<string, unknown>,
    items: [] as unknown[],
  }),
  metadata: {
    version: 2,
    role: 'root',
  },
});

export const RootBlockSchemaExtension = BlockSchemaExtension(RootBlockSchema);

export class RootBlockModel extends BlockModel<
  ReturnType<(typeof RootBlockSchema)['model']['props']>
> {}

export const NoteBlockSchema = defineBlockSchema({
  flavour: 'polymind:note',
  props: () => ({}),
  metadata: {
    version: 1,
    role: 'hub',
    parent: ['polymind:page'],
    children: [
      'polymind:paragraph',
      'polymind:list',
      'polymind:code',
      'polymind:divider',
      'polymind:database',
      'polymind:data-view',
      'polymind:image',
      'polymind:note-block-*',
      'polymind:bookmark',
      'polymind:attachment',
      'polymind:surface-ref',
      'polymind:embed-*',
    ],
  },
});

export const NoteBlockSchemaExtension = BlockSchemaExtension(NoteBlockSchema);

export const ParagraphBlockSchema = defineBlockSchema({
  flavour: 'polymind:paragraph',
  props: internal => ({
    type: 'text',
    text: internal.Text(),
  }),
  metadata: {
    version: 1,
    role: 'content',
    parent: [
      'polymind:note',
      'polymind:database',
      'polymind:paragraph',
      'polymind:list',
    ],
  },
});

export const ParagraphBlockSchemaExtension =
  BlockSchemaExtension(ParagraphBlockSchema);

export const ListBlockSchema = defineBlockSchema({
  flavour: 'polymind:list',
  props: internal => ({
    type: 'bulleted',
    text: internal.Text(),
    checked: false,
    collapsed: false,
  }),
  metadata: {
    version: 1,
    role: 'content',
    parent: [
      'polymind:note',
      'polymind:database',
      'polymind:list',
      'polymind:paragraph',
    ],
  },
});

export const ListBlockSchemaExtension = BlockSchemaExtension(ListBlockSchema);

export const DividerBlockSchema = defineBlockSchema({
  flavour: 'polymind:divider',
  metadata: {
    version: 1,
    role: 'content',
    children: [],
  },
});

export const DividerBlockSchemaExtension =
  BlockSchemaExtension(DividerBlockSchema);
