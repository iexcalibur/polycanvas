import type { PolymindTextAttributes } from '@blockmind/polymind-shared/types';
import { StdIdentifier } from '@blockmind/std';
import { InlineSpecExtension } from '@blockmind/std/inline';
import { html } from 'lit';
import { z } from 'zod';

export const MentionInlineSpecExtension =
  InlineSpecExtension<PolymindTextAttributes>('mention', provider => {
    const std = provider.get(StdIdentifier);
    return {
      name: 'mention',
      schema: z.object({
        mention: z
          .object({
            member: z.string(),
            notification: z.string().optional(),
          })
          .optional()
          .nullable()
          .catch(undefined),
      }),
      match: delta => {
        return !!delta.attributes?.mention?.member;
      },
      renderer: ({ delta, selected }) => {
        return html`<polymind-mention
          .delta=${delta}
          .std=${std}
          .selected=${selected}
        ></polymind-mention>`;
      },
      embed: true,
    };
  });
