import { ListBlockComponent } from './list-block.js';

export function effects() {
  customElements.define('polymind-list', ListBlockComponent);
}

declare global {
  interface HTMLElementTagNameMap {
    'polymind-list':  ListBlockComponent;
  }
}
