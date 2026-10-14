import { PolymindText } from './nodes/polymind-text';

export function effects() {
  customElements.define('polymind-text', PolymindText);
}

declare global {
  interface HTMLElementTagNameMap {
    'polymind-text':  PolymindText;
  }
}
