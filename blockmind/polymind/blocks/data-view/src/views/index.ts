import type { ViewMeta } from '@blockmind/data-view';
import { viewPresets } from '@blockmind/data-view/view-presets';

export const blockQueryViews: ViewMeta[] = [
  viewPresets.tableViewMeta,
  viewPresets.kanbanViewMeta,
];

export const blockQueryViewMap = Object.fromEntries(
  blockQueryViews.map(view => [view.type, view])
);
