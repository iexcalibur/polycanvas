import {
  POLYMIND_PAGE_DRAGGING_AREA_WIDGET,
  PolymindPageDraggingAreaWidget,
} from './index';

export function effects() {
  customElements.define(
    POLYMIND_PAGE_DRAGGING_AREA_WIDGET,
    PolymindPageDraggingAreaWidget
  );
}
