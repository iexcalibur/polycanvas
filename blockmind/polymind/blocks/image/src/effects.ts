import { ImageBlockFallbackCard } from './components/image-block-fallback.js';
import { ImageBlockPageComponent } from './components/page-image-block.js';
import { ImageBlockComponent } from './image-block.js';
import { ImageEdgelessBlockComponent } from './image-edgeless-block.js';
import { ImageEdgelessPlaceholderBlockComponent } from './preview-image/edgeless.js';
import { ImagePlaceholderBlockComponent } from './preview-image/page.js';

export function effects() {
  customElements.define('polymind-image', ImageBlockComponent);
  customElements.define('polymind-edgeless-image', ImageEdgelessBlockComponent);
  customElements.define('polymind-page-image', ImageBlockPageComponent);
  customElements.define('polymind-image-fallback-card', ImageBlockFallbackCard);
  customElements.define(
    'polymind-placeholder-preview-image',
    ImagePlaceholderBlockComponent
  );
  customElements.define(
    'polymind-edgeless-placeholder-preview-image',
    ImageEdgelessPlaceholderBlockComponent
  );
}
