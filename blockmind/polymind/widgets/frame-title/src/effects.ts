import {
  POLYMIND_FRAME_TITLE_WIDGET,
  PolymindFrameTitleWidget,
} from './polymind-frame-title-widget.js';
import { EdgelessFrameTitleEditor } from './edgeless-frame-title-editor.js';
import { POLYMIND_FRAME_TITLE, PolymindFrameTitle } from './frame-title.js';

export function effects() {
  customElements.define(POLYMIND_FRAME_TITLE_WIDGET, PolymindFrameTitleWidget);
  customElements.define(POLYMIND_FRAME_TITLE, PolymindFrameTitle);
  customElements.define(
    'edgeless-frame-title-editor',
    EdgelessFrameTitleEditor
  );
}
