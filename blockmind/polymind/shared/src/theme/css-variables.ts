/* CSS variables. You need to handle all places where `CSS variables` are marked. */

import { LINE_COLORS } from '@blockmind/polymind-model';
import {
  type PolymindCssVariables,
  type PolymindTheme,
  cssVar,
} from '@polycanvas/theme';
export { cssVar } from '@polycanvas/theme';
import { type PolymindThemeKeyV2, cssVarV2 } from '@polycanvas/theme/v2';
import { unsafeCSS } from 'lit';
export { cssVarV2 } from '@polycanvas/theme/v2';
export const ColorVariables = [
  '--polymind-brand-color',
  '--polymind-primary-color',
  '--polymind-secondary-color',
  '--polymind-tertiary-color',
  '--polymind-hover-color',
  '--polymind-icon-color',
  '--polymind-icon-secondary',
  '--polymind-border-color',
  '--polymind-divider-color',
  '--polymind-placeholder-color',
  '--polymind-quote-color',
  '--polymind-link-color',
  '--polymind-edgeless-grid-color',
  '--polymind-success-color',
  '--polymind-warning-color',
  '--polymind-error-color',
  '--polymind-processing-color',
  '--polymind-text-emphasis-color',
  '--polymind-text-primary-color',
  '--polymind-text-secondary-color',
  '--polymind-text-disable-color',
  '--polymind-black-10',
  '--polymind-black-30',
  '--polymind-black-50',
  '--polymind-black-60',
  '--polymind-black-80',
  '--polymind-black-90',
  '--polymind-black',
  '--polymind-white-10',
  '--polymind-white-30',
  '--polymind-white-50',
  '--polymind-white-60',
  '--polymind-white-80',
  '--polymind-white-90',
  '--polymind-white',
  '--polymind-background-code-block',
  '--polymind-background-tertiary-color',
  '--polymind-background-processing-color',
  '--polymind-background-error-color',
  '--polymind-background-warning-color',
  '--polymind-background-success-color',
  '--polymind-background-primary-color',
  '--polymind-background-secondary-color',
  '--polymind-background-modal-color',
  '--polymind-background-overlay-panel-color',
  '--polymind-tag-blue',
  '--polymind-tag-green',
  '--polymind-tag-teal',
  '--polymind-tag-white',
  '--polymind-tag-purple',
  '--polymind-tag-red',
  '--polymind-tag-pink',
  '--polymind-tag-yellow',
  '--polymind-tag-orange',
  '--polymind-tag-gray',
  ...LINE_COLORS,
  '--polymind-tooltip',
  '--polymind-blue',
];

export const SizeVariables = [
  '--polymind-font-h-1',
  '--polymind-font-h-2',
  '--polymind-font-h-3',
  '--polymind-font-h-4',
  '--polymind-font-h-5',
  '--polymind-font-h-6',
  '--polymind-font-base',
  '--polymind-font-sm',
  '--polymind-font-xs',
  '--polymind-line-height',
  '--polymind-z-index-modal',
  '--polymind-z-index-popover',
];

export const FontFamilyVariables = [
  '--polymind-font-family',
  '--polymind-font-number-family',
  '--polymind-font-code-family',
];

export const StyleVariables = [
  '--polymind-editor-width',

  '--polymind-theme-mode',
  '--polymind-editor-mode',
  /* --polymind-palette-transparent: special values added for the sake of logical consistency. */
  '--polymind-palette-transparent',

  '--polymind-popover-shadow',
  '--polymind-menu-shadow',
  '--polymind-float-button-shadow',
  '--polymind-shadow-1',
  '--polymind-shadow-2',
  '--polymind-shadow-3',

  '--polymind-paragraph-space',
  '--polymind-popover-radius',
  '--polymind-scale',
  ...SizeVariables,
  ...ColorVariables,
  ...FontFamilyVariables,
] as const;

type VariablesType = typeof StyleVariables;
export type CssVariableName = Extract<
  VariablesType[keyof VariablesType],
  string
>;

export type CssVariablesMap = Record<CssVariableName, string>;

export const unsafeCSSVar = (
  key: keyof PolymindCssVariables | keyof PolymindTheme,
  fallback?: string
) => unsafeCSS(cssVar(key, fallback));

export const unsafeCSSVarV2 = (key: PolymindThemeKeyV2, fallback?: string) =>
  unsafeCSS(cssVarV2(key, fallback));
