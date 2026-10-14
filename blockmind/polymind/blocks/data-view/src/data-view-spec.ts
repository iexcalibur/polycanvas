import { BlockViewExtension, FlavourExtension } from '@blockmind/std';
import type { ExtensionType } from '@blockmind/store';
import { literal } from 'lit/static-html.js';

export const DataViewBlockSpec: ExtensionType[] = [
  FlavourExtension('polymind:data-view'),
  BlockViewExtension('polymind:data-view', literal`polymind-data-view`),
];
