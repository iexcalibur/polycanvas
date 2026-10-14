import { PolymindMention } from './polymind-mention';

export function effects() {
  customElements.define('polymind-mention', PolymindMention);
}

declare global {
  interface HTMLElementTagNameMap {
    'polymind-mention':  PolymindMention;
  }
}
