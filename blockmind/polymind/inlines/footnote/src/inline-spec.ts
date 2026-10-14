import { FootNoteSchema } from '@blockmind/polymind-model';
import type { PolymindTextAttributes } from '@blockmind/polymind-shared/types';
import { StdIdentifier } from '@blockmind/std';
import { InlineSpecExtension } from '@blockmind/std/inline';
import { html } from 'lit';
import z from 'zod';

import { FootNoteNodeConfigIdentifier } from './footnote-node/footnote-config';

export const FootNoteInlineSpecExtension =
  InlineSpecExtension<PolymindTextAttributes>('footnote', provider => {
    const std = provider.get(StdIdentifier);
    const config =
      provider.getOptional(FootNoteNodeConfigIdentifier) ?? undefined;
    return {
      name: 'footnote',
      schema: z.object({
        footnote: FootNoteSchema.optional().nullable().catch(undefined),
      }),
      match: delta => {
        return !!delta.attributes?.footnote;
      },
      renderer: ({ delta }) => {
        return html`<polymind-footnote-node
          .delta=${delta}
          .std=${std}
          .config=${config}
        ></polymind-footnote-node>`;
      },
      embed: true,
    };
  });
