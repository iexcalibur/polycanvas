import {
  POLYMIND_KEYBOARD_TOOLBAR_WIDGET,
  PolymindKeyboardToolbarWidget,
} from './index.js';
import {
  POLYMIND_KEYBOARD_TOOL_PANEL,
  PolymindKeyboardToolPanel,
} from './keyboard-tool-panel.js';
import {
  POLYMIND_KEYBOARD_TOOLBAR,
  PolymindKeyboardToolbar,
} from './keyboard-toolbar.js';

export function effects() {
  customElements.define(
    POLYMIND_KEYBOARD_TOOLBAR_WIDGET,
    PolymindKeyboardToolbarWidget
  );
  customElements.define(POLYMIND_KEYBOARD_TOOLBAR, PolymindKeyboardToolbar);
  customElements.define(POLYMIND_KEYBOARD_TOOL_PANEL, PolymindKeyboardToolPanel);
}

declare global {
  interface HTMLElementTagNameMap {
    [POLYMIND_KEYBOARD_TOOLBAR]: PolymindKeyboardToolbar;
    [POLYMIND_KEYBOARD_TOOL_PANEL]: PolymindKeyboardToolPanel;
  }
}
