import { DocTitle } from './doc-title';

export * from './doc-title';

export function effects() {
  customElements.define('polymind-linked-doc-title', DocTitle);
}
