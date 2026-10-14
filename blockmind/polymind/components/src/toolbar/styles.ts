import {
  type PolymindCssVariables,
  combinedDarkCssVariables,
  combinedLightCssVariables,
} from '@polycanvas/theme';
import { unsafeCSS } from 'lit';

const toolbarColorKeys: Array<keyof PolymindCssVariables> = [
  '--polymind-background-overlay-panel-color',
  '--polymind-v2-layer-background-overlayPanel' as never,
  '--polymind-v2-layer-insideBorder-blackBorder' as never,
  '--polymind-v2-icon-primary' as never,
  '--polymind-background-error-color',
  '--polymind-background-primary-color',
  '--polymind-background-tertiary-color',
  '--polymind-icon-color',
  '--polymind-icon-secondary',
  '--polymind-border-color',
  '--polymind-divider-color',
  '--polymind-text-primary-color',
  '--polymind-hover-color',
  '--polymind-hover-color-filled',
];

export const lightToolbarStyles = (selector: string) => `
  ${selector}[data-app-theme='light'] {
    ${toolbarColorKeys
      .map(key => `${key}: ${unsafeCSS(combinedLightCssVariables[key])};`)
      .join('\n')}
  }
`;

export const darkToolbarStyles = (selector: string) => `
  ${selector}[data-app-theme='dark'] {
    ${toolbarColorKeys
      .map(key => `${key}: ${unsafeCSS(combinedDarkCssVariables[key])};`)
      .join('\n')}
  }
`;
