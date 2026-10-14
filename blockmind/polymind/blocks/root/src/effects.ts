import {
  EdgelessRootBlockComponent,
  EdgelessRootPreviewBlockComponent,
  PageRootBlockComponent,
  PreviewRootBlockComponent,
} from './index.js';

export function effects() {
  // Register components by category
  registerRootComponents();
}

function registerRootComponents() {
  customElements.define('polymind-page-root', PageRootBlockComponent);
  customElements.define('polymind-preview-root', PreviewRootBlockComponent);
  customElements.define('polymind-edgeless-root', EdgelessRootBlockComponent);
  customElements.define(
    'polymind-edgeless-root-preview',
    EdgelessRootPreviewBlockComponent
  );
}

declare global {
  interface HTMLElementTagNameMap {
    'polymind-edgeless-root':  EdgelessRootBlockComponent;
    'polymind-page-root':  PageRootBlockComponent;
  }
}
