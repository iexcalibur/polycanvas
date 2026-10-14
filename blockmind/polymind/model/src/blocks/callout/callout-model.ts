import type { IconData } from '@blockmind/polymind-shared/services';
import {
  BlockModel,
  BlockSchemaExtension,
  defineBlockSchema,
  type Text,
} from '@blockmind/store';

import type { BlockMeta } from '../../utils/types';

export type CalloutProps = {
  icon?: IconData;
  text: Text;
  backgroundColorName?: string;
} & BlockMeta;

export const CalloutBlockSchema = defineBlockSchema({
  flavour: 'polymind:callout',
  props: (internal): CalloutProps => ({
    icon: { type: 'emoji', unicode: '💡' } as IconData,
    text: internal.Text(),
    backgroundColorName: 'grey',
    'meta:createdAt': undefined,
    'meta:updatedAt': undefined,
    'meta:createdBy': undefined,
    'meta:updatedBy': undefined,
  }),
  metadata: {
    version: 1,
    role: 'hub',
    parent: [
      'polymind:note',
      'polymind:database',
      'polymind:paragraph',
      'polymind:list',
      'polymind:edgeless-text',
      'polymind:transcription',
    ],
    children: ['polymind:paragraph', 'polymind:list'],
  },
  toModel: () => new CalloutBlockModel(),
});

export class CalloutBlockModel extends BlockModel<CalloutProps> {}

export const CalloutBlockSchemaExtension =
  BlockSchemaExtension(CalloutBlockSchema);
