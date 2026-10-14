import { WidgetViewExtension } from '@blockmind/std';
import { literal, unsafeStatic } from 'lit/static-html.js';

import { POLYMIND_TOOLBAR_WIDGET } from './toolbar';

export * from './toolbar';

export const toolbarWidget = WidgetViewExtension(
  'polymind:page',
  POLYMIND_TOOLBAR_WIDGET,
  literal`${unsafeStatic(POLYMIND_TOOLBAR_WIDGET)}`
);
