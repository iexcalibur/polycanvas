import { LatexBlockSchema } from '@blockmind/polymind-model';
import {
  BlockMarkdownAdapterExtension,
  type BlockMarkdownAdapterMatcher,
  type MarkdownAST,
} from '@blockmind/polymind-shared/adapters';
import { nanoid } from '@blockmind/store';

const isLatexNode = (node: MarkdownAST) => node.type === 'math';

export const latexBlockMarkdownAdapterMatcher: BlockMarkdownAdapterMatcher = {
  flavour: LatexBlockSchema.model.flavour,
  toMatch: o => isLatexNode(o.node),
  fromMatch: o => o.node.flavour === LatexBlockSchema.model.flavour,
  toBlockSnapshot: {
    enter: (o, context) => {
      const latex = 'value' in o.node ? o.node.value : '';
      const { walkerContext } = context;
      walkerContext
        .openNode(
          {
            type: 'block',
            id: nanoid(),
            flavour: 'polymind:latex',
            props: {
              latex,
            },
            children: [],
          },
          'children'
        )
        .closeNode();
    },
  },
  fromBlockSnapshot: {
    enter: (o, context) => {
      const latex =
        'latex' in o.node.props ? (o.node.props.latex as string) : '';
      const { walkerContext } = context;
      walkerContext
        .openNode(
          {
            type: 'math',
            value: latex,
          },
          'children'
        )
        .closeNode();
    },
  },
};

export const LatexBlockMarkdownAdapterExtension = BlockMarkdownAdapterExtension(
  latexBlockMarkdownAdapterMatcher
);
