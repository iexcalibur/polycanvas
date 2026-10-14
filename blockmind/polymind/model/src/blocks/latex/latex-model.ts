import {
  type GfxCommonBlockProps,
  GfxCompatible,
  type GfxElementGeometry,
} from '@blockmind/std/gfx';
import {
  BlockModel,
  BlockSchemaExtension,
  defineBlockSchema,
} from '@blockmind/store';

export type LatexProps = {
  latex: string;
  comments?: Record<string, boolean>;
} & GfxCommonBlockProps;

export const LatexBlockSchema = defineBlockSchema({
  flavour: 'polymind:latex',
  props: (): LatexProps => ({
    xywh: '[0,0,16,16]',
    index: 'a0',
    lockedBySelf: false,
    scale: 1,
    rotate: 0,
    latex: '',
    comments: undefined,
  }),
  metadata: {
    version: 1,
    role: 'content',
    parent: [
      'polymind:note',
      'polymind:edgeless-text',
      'polymind:paragraph',
      'polymind:list',
    ],
  },
  toModel: () => {
    return new LatexBlockModel();
  },
});

export const LatexBlockSchemaExtension = BlockSchemaExtension(LatexBlockSchema);

export class LatexBlockModel
  extends GfxCompatible<LatexProps>(BlockModel)
  implements GfxElementGeometry {}
