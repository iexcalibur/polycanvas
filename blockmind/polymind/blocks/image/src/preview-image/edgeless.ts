import { unsafeCSSVarV2 } from '@blockmind/polymind-shared/theme';
import { toGfxBlockComponent } from '@blockmind/std';
import { css } from 'lit';

import { ImagePlaceholderBlockComponent } from './page.js';

export class ImageEdgelessPlaceholderBlockComponent extends toGfxBlockComponent(
  ImagePlaceholderBlockComponent
) {
  static override styles = css`
    polymind-edgeless-placeholder-preview-image
      .polymind-placeholder-preview-container {
      border: 1px solid ${unsafeCSSVarV2('layer/background/tertiary')};
    }
  `;

  override renderGfxBlock(): unknown {
    return super.renderGfxBlock();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'polymind-edgeless-placeholder-preview-image': ImageEdgelessPlaceholderBlockComponent;
  }
}
