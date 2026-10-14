import { SurfaceBlockComponent } from './surface-block.js';
import { SurfaceBlockVoidComponent } from './surface-block-void.js';

export function effects() {
  customElements.define('polymind-surface-void', SurfaceBlockVoidComponent);
  customElements.define('polymind-surface', SurfaceBlockComponent);
}
