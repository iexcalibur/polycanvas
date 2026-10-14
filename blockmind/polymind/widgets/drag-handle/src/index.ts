import { WidgetViewExtension } from '@blockmind/std';
import { literal, unsafeStatic } from 'lit/static-html.js';

import { POLYMIND_DRAG_HANDLE_WIDGET } from './consts';

export * from './consts';
export * from './drag-handle';
export * from './utils';
export type { DragBlockPayload } from './watchers/drag-event-watcher';

export const dragHandleWidget = WidgetViewExtension(
  'polymind:page',
  POLYMIND_DRAG_HANDLE_WIDGET,
  literal`${unsafeStatic(POLYMIND_DRAG_HANDLE_WIDGET)}`
);
