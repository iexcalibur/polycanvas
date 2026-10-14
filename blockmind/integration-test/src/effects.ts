import '@blockmind/polymind/effects';

import { TestPolymindEditorContainer } from './editors/index.js';

export function effects() {
  customElements.define('polymind-editor-container', TestPolymindEditorContainer);
}
