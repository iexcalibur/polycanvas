import type { Rect } from '@blockmind/polymind-gfx-turbo-renderer';
import {
  BlockLayoutHandlerExtension,
  BlockLayoutHandlersIdentifier,
} from '@blockmind/polymind-gfx-turbo-renderer';
import type { Container } from '@blockmind/global/di';
import type { EditorHost, GfxBlockComponent } from '@blockmind/std';
import { clientToModelCoord, type ViewportRecord } from '@blockmind/std/gfx';
import type { BlockModel } from '@blockmind/store';

import type { CodeLayout } from './code-painter.worker';

export class CodeLayoutHandlerExtension extends BlockLayoutHandlerExtension<CodeLayout> {
  readonly blockType = 'polymind:code';

  static override setup(di: Container) {
    di.addImpl(
      BlockLayoutHandlersIdentifier('code'),
      CodeLayoutHandlerExtension
    );
  }

  override queryLayout(
    model: BlockModel,
    host: EditorHost,
    viewportRecord: ViewportRecord
  ): CodeLayout | null {
    const component = host.std.view.getBlock(
      model.id
    ) as GfxBlockComponent | null;
    if (!component) return null;

    const codeBlockElement = component.querySelector(
      '.polymind-code-block-container'
    );
    if (!codeBlockElement) return null;

    const { zoom, viewScale } = viewportRecord;
    const codeLayout: CodeLayout = {
      type: 'polymind:code',
      blockId: model.id,
      rect: { x: 0, y: 0, w: 0, h: 0 },
    };

    // Get the bounding rect of the code block
    const clientRect = codeBlockElement.getBoundingClientRect();
    if (!clientRect) return null;

    // Convert client coordinates to model coordinates
    const [modelX, modelY] = clientToModelCoord(viewportRecord, [
      clientRect.x,
      clientRect.y,
    ]);

    codeLayout.rect = {
      x: modelX,
      y: modelY,
      w: clientRect.width / zoom / viewScale,
      h: clientRect.height / zoom / viewScale,
    };

    return codeLayout;
  }

  calculateBound(layout: CodeLayout) {
    const rect: Rect = layout.rect;

    return {
      rect,
      subRects: [rect],
    };
  }
}
