import { CodeBlockSchema } from '@blockmind/polymind-model';
import {
  BlockPlainTextAdapterExtension,
  type BlockPlainTextAdapterMatcher,
} from '@blockmind/polymind-shared/adapters';
import type { DeltaInsert } from '@blockmind/store';

export const codeBlockPlainTextAdapterMatcher: BlockPlainTextAdapterMatcher = {
  flavour: CodeBlockSchema.model.flavour,
  toMatch: () => false,
  fromMatch: o => o.node.flavour === CodeBlockSchema.model.flavour,
  toBlockSnapshot: {},
  fromBlockSnapshot: {
    enter: (o, context) => {
      const text = (o.node.props.text ?? { delta: [] }) as {
        delta: DeltaInsert[];
      };
      const buffer = text.delta.map(delta => delta.insert).join('');
      context.textBuffer.content += buffer;
      context.textBuffer.content += '\n';
    },
  },
};

export const CodeBlockPlainTextAdapterExtension =
  BlockPlainTextAdapterExtension(codeBlockPlainTextAdapterMatcher);
