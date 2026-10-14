import { CheckboxCell } from './checkbox/cell-renderer.js';
import { DateCell } from './date/cell-renderer.js';
import { ImageCell } from './image/cell-renderer.js';
import { MultiSelectCell } from './multi-select/cell-renderer.js';
import { NumberCell } from './number/cell-renderer.js';
import { ProgressCell } from './progress/cell-renderer.js';
import { SelectCell } from './select/cell-renderer.js';
import { TextCell } from './text/cell-renderer.js';

export function propertyPresetsEffects() {
  customElements.define('polymind-database-checkbox-cell', CheckboxCell);
  customElements.define('polymind-database-date-cell', DateCell);
  customElements.define('polymind-database-image-cell', ImageCell);
  customElements.define('polymind-database-multi-select-cell', MultiSelectCell);
  customElements.define('polymind-database-number-cell', NumberCell);
  customElements.define('polymind-database-progress-cell', ProgressCell);
  customElements.define('polymind-database-select-cell', SelectCell);
  customElements.define('polymind-database-text-cell', TextCell);
}
