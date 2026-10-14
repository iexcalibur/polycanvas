import {
  POLYMIND_VIEWPORT_OVERLAY_WIDGET,
  PolymindViewportOverlayWidget,
} from './index';

export function effects() {
  customElements.define(
    POLYMIND_VIEWPORT_OVERLAY_WIDGET,
    PolymindViewportOverlayWidget
  );
}
