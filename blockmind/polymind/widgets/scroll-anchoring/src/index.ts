import { WidgetViewExtension } from '@blockmind/std';
import { literal, unsafeStatic } from 'lit/static-html.js';

import { POLYMIND_SCROLL_ANCHORING_WIDGET } from './scroll-anchoring.js';

export * from './scroll-anchoring.js';

export const scrollAnchoringWidget = WidgetViewExtension(
  'polymind:page',
  POLYMIND_SCROLL_ANCHORING_WIDGET,
  literal`${unsafeStatic(POLYMIND_SCROLL_ANCHORING_WIDGET)}`
);
