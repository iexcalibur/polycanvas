import { createIdentifier } from '@blockmind/global/di';
import type { EditorHost } from '@blockmind/std';
import type { ViewportRecord } from '@blockmind/std/gfx';
import type { BlockModel } from '@blockmind/store';
import { Extension } from '@blockmind/store';

import type { BlockLayout, Rect } from '../types';

export abstract class BlockLayoutHandlerExtension<
  T extends BlockLayout = BlockLayout,
> extends Extension {
  abstract readonly blockType: string;

  abstract queryLayout(
    model: BlockModel,
    host: EditorHost,
    viewportRecord: ViewportRecord
  ): T | null;

  abstract calculateBound(layout: T): {
    rect: Rect;
    subRects: Rect[];
  };
}

export const BlockLayoutHandlersIdentifier =
  createIdentifier<BlockLayoutHandlerExtension>(
    'BlockLayoutHandlersIdentifier'
  );
