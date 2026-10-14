import {
  DomElementRendererExtension,
  type DomRenderer,
} from '@blockmind/polymind-block-surface';
import type { HighlighterElementModel } from '@blockmind/polymind-model';
import { DefaultTheme } from '@blockmind/polymind-model';

import { renderBrushLikeDom } from './shared';

export const HighlighterDomRendererExtension = DomElementRendererExtension(
  'highlighter',
  (
    model: HighlighterElementModel,
    domElement: HTMLElement,
    renderer: DomRenderer
  ) => {
    renderBrushLikeDom({
      model,
      domElement,
      renderer,
      color: renderer.getColorValue(
        model.color,
        DefaultTheme.hightlighterColor,
        true
      ),
    });
  }
);
