import { type FrameBlockModel } from '@blockmind/polymind-model';
import { WidgetComponent, WidgetViewExtension } from '@blockmind/std';
import { html } from 'lit';
import { literal, unsafeStatic } from 'lit/static-html.js';

export const POLYMIND_FRAME_TITLE_WIDGET = 'polymind-frame-title-widget';

export class PolymindFrameTitleWidget extends WidgetComponent<FrameBlockModel> {
  override render() {
    return html`<polymind-frame-title
      .model=${this.model}
      data-id=${this.model.id}
    ></polymind-frame-title>`;
  }
}

export const frameTitleWidget = WidgetViewExtension(
  'polymind:frame',
  POLYMIND_FRAME_TITLE_WIDGET,
  literal`${unsafeStatic(POLYMIND_FRAME_TITLE_WIDGET)}`
);
