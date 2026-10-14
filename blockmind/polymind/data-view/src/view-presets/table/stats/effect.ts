import { DataBaseColumnStats } from './column-stats-bar.js';
import { DatabaseColumnStatsCell } from './column-stats-column.js';

export function statsEffects() {
  customElements.define('polymind-database-column-stats', DataBaseColumnStats);
  customElements.define(
    'polymind-database-column-stats-cell',
    DatabaseColumnStatsCell
  );
}
