import {
  POLYMIND_SCROLL_ANCHORING_WIDGET,
  PolymindScrollAnchoringWidget,
} from './scroll-anchoring.js';

export function effects() {
  customElements.define(
    POLYMIND_SCROLL_ANCHORING_WIDGET,
    PolymindScrollAnchoringWidget
  );
}

declare global {
  interface HTMLElementTagNameMap {
    [POLYMIND_SCROLL_ANCHORING_WIDGET]: PolymindScrollAnchoringWidget;
  }
}
