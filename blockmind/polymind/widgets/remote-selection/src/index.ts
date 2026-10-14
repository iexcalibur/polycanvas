import { WidgetViewExtension } from '@blockmind/std';
import { literal, unsafeStatic } from 'lit/static-html.js';

import { POLYMIND_DOC_REMOTE_SELECTION_WIDGET } from './doc';
import { POLYMIND_EDGELESS_REMOTE_SELECTION_WIDGET } from './edgeless';

export * from './doc';
export * from './edgeless';

export const docRemoteSelectionWidget = WidgetViewExtension(
  'polymind:page',
  POLYMIND_DOC_REMOTE_SELECTION_WIDGET,
  literal`${unsafeStatic(POLYMIND_DOC_REMOTE_SELECTION_WIDGET)}`
);

export const edgelessRemoteSelectionWidget = WidgetViewExtension(
  'polymind:page',
  POLYMIND_EDGELESS_REMOTE_SELECTION_WIDGET,
  literal`${unsafeStatic(POLYMIND_EDGELESS_REMOTE_SELECTION_WIDGET)}`
);
