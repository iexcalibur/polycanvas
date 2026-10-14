import { POLYMIND_TOOLBAR_WIDGET, PolymindToolbarWidget } from './toolbar';

export function effects() {
  customElements.define(POLYMIND_TOOLBAR_WIDGET, PolymindToolbarWidget);
}

declare global {
  interface HTMLElementTagNameMap {
    [POLYMIND_TOOLBAR_WIDGET]: PolymindToolbarWidget;
  }
}
