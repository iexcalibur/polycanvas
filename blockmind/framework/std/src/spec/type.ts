import type { BlockModel } from '@blockmind/store';
import type { StaticValue } from 'lit/static-html.js';

export type BlockViewType = StaticValue | ((model: BlockModel) => StaticValue);
export type WidgetViewType = StaticValue;
