import { Tooltip } from './tooltip.js';

export function effects() {
  if (!customElements.get('polymind-tooltip')) {
    customElements.define('polymind-tooltip', Tooltip);
  }
}
