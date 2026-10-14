import type { PolymindTextAttributes } from '@blockmind/polymind-shared/types';
import {
  type InlineRootElement,
  InlineSpecExtension,
} from '@blockmind/std/inline';
import type { ExtensionType } from '@blockmind/store';
import { html } from 'lit';
import { z } from 'zod';

export type PolymindInlineRootElement = InlineRootElement<PolymindTextAttributes>;

export const BoldInlineSpecExtension =
  InlineSpecExtension<PolymindTextAttributes>({
    name: 'bold',
    schema: z.object({
      bold: z.literal(true).optional().nullable().catch(undefined),
    }),
    match: delta => {
      return !!delta.attributes?.bold;
    },
    renderer: ({ delta }) => {
      return html`<polymind-text .delta=${delta}></polymind-text>`;
    },
  });

export const ItalicInlineSpecExtension =
  InlineSpecExtension<PolymindTextAttributes>({
    name: 'italic',
    schema: z.object({
      italic: z.literal(true).optional().nullable().catch(undefined),
    }),
    match: delta => {
      return !!delta.attributes?.italic;
    },
    renderer: ({ delta }) => {
      return html`<polymind-text .delta=${delta}></polymind-text>`;
    },
  });

export const UnderlineInlineSpecExtension =
  InlineSpecExtension<PolymindTextAttributes>({
    name: 'underline',
    schema: z.object({
      underline: z.literal(true).optional().nullable().catch(undefined),
    }),
    match: delta => {
      return !!delta.attributes?.underline;
    },
    renderer: ({ delta }) => {
      return html`<polymind-text .delta=${delta}></polymind-text>`;
    },
  });

export const StrikeInlineSpecExtension =
  InlineSpecExtension<PolymindTextAttributes>({
    name: 'strike',
    schema: z.object({
      strike: z.literal(true).optional().nullable().catch(undefined),
    }),
    match: delta => {
      return !!delta.attributes?.strike;
    },
    renderer: ({ delta }) => {
      return html`<polymind-text .delta=${delta}></polymind-text>`;
    },
  });

export const CodeInlineSpecExtension =
  InlineSpecExtension<PolymindTextAttributes>({
    name: 'inline-code',
    schema: z.object({
      code: z.literal(true).optional().nullable().catch(undefined),
    }),
    match: delta => {
      return !!delta.attributes?.code;
    },
    renderer: ({ delta }) => {
      return html`<polymind-text .delta=${delta}></polymind-text>`;
    },
  });

export const BackgroundInlineSpecExtension =
  InlineSpecExtension<PolymindTextAttributes>({
    name: 'background',
    schema: z.object({
      background: z.string().optional().nullable().catch(undefined),
    }),
    match: delta => {
      return !!delta.attributes?.background;
    },
    renderer: ({ delta }) => {
      return html`<polymind-text .delta=${delta}></polymind-text>`;
    },
  });

export const ColorInlineSpecExtension =
  InlineSpecExtension<PolymindTextAttributes>({
    name: 'color',
    schema: z.object({
      color: z.string().optional().nullable().catch(undefined),
    }),
    match: delta => {
      return !!delta.attributes?.color;
    },
    renderer: ({ delta }) => {
      return html`<polymind-text .delta=${delta}></polymind-text>`;
    },
  });

export const InlineSpecExtensions: ExtensionType[] = [
  BoldInlineSpecExtension,
  ItalicInlineSpecExtension,
  UnderlineInlineSpecExtension,
  StrikeInlineSpecExtension,
  CodeInlineSpecExtension,
  BackgroundInlineSpecExtension,
  ColorInlineSpecExtension,
];
