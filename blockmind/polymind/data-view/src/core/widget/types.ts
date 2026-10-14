import type { UniComponent } from '@blockmind/polymind-shared/types';

import type { DataViewUILogicBase } from '../view/data-view-base.js';

export type DataViewWidgetProps<
  ViewLogic extends DataViewUILogicBase = DataViewUILogicBase,
> = {
  dataViewLogic: ViewLogic;
};
export type DataViewWidget = UniComponent<DataViewWidgetProps>;
