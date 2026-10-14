import {
  DomElementRendererExtension,
  type DomRenderer,
} from '@blockmind/polymind-block-surface';
import type { BrushElementModel } from '@blockmind/polymind-model';
import { DefaultTheme } from '@blockmind/polymind-model';

import { renderBrushLikeDom } from './shared';

export const BrushDomRendererExtension = DomElementRendererExtension(
  'brush',
  (
    model: BrushElementModel,
    domElement: HTMLElement,
    renderer: DomRenderer
  ) => {
    renderBrushLikeDom({
      model,
      domElement,
      renderer,
      color: renderer.getColorValue(model.color, DefaultTheme.black, true),
    });
  }
);
