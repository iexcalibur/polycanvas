import type { UIEventHandler } from '@blockmind/std';

import type { PolymindDragHandleWidget } from '../drag-handle.js';

export class KeyboardEventWatcher {
  private readonly _keyboardHandler: UIEventHandler = ctx => {
    if (!this.widget.dragging) {
      return;
    }

    const state = ctx.get('defaultState');
    const event = state.event as KeyboardEvent;
    event.preventDefault();
    event.stopPropagation();
  };

  constructor(readonly widget: PolymindDragHandleWidget) {}

  watch() {
    this.widget.handleEvent('beforeInput', () => this.widget.hide());
    this.widget.handleEvent('keyDown', this._keyboardHandler, { global: true });
    this.widget.handleEvent('keyUp', this._keyboardHandler, { global: true });
  }
}
