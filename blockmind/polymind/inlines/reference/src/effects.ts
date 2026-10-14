import { PolymindReference, ReferencePopup } from './reference-node';

export function effects() {
  customElements.define('reference-popup', ReferencePopup);
  customElements.define('polymind-reference', PolymindReference);
}

declare global {
  interface HTMLElementTagNameMap {
    'polymind-reference':  PolymindReference;
    'reference-popup': ReferencePopup;
  }
}
