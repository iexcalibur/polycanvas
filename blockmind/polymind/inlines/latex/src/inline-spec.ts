import type { PolymindTextAttributes } from '@blockmind/polymind-shared/types';
import { StdIdentifier } from '@blockmind/std';
import { InlineSpecExtension } from '@blockmind/std/inline';
import { html } from 'lit';
import { z } from 'zod';

export const LatexInlineSpecExtension =
  InlineSpecExtension<PolymindTextAttributes>('latex', provider => {
    const std = provider.get(StdIdentifier);
    return {
      name: 'latex',
      schema: z.object({
        latex: z.string().optional().nullable().catch(undefined),
      }),
      match: delta => typeof delta.attributes?.latex === 'string',
      renderer: ({ delta, selected, editor, startOffset, endOffset }) => {
        return html`<polymind-latex-node
          .std=${std}
          .delta=${delta}
          .selected=${selected}
          .editor=${editor}
          .startOffset=${startOffset}
          .endOffset=${endOffset}
        ></polymind-latex-node>`;
      },
      embed: true,
    };
  });

export const LatexEditorUnitSpecExtension =
  InlineSpecExtension<PolymindTextAttributes>({
    name: 'latex-editor-unit',
    schema: z.object({
      'latex-editor-unit': z.undefined(),
    }),
    match: () => true,
    renderer: ({ delta }) => {
      return html`<latex-editor-unit .delta=${delta}></latex-editor-unit>`;
    },
  });
