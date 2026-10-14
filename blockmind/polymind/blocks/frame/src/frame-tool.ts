import {
  DefaultTool,
  OverlayIdentifier,
} from '@blockmind/polymind-block-surface';
import type { FrameBlockModel } from '@blockmind/polymind-model';
import { EditPropsStore } from '@blockmind/polymind-shared/services';
import type { IPoint, IVec } from '@blockmind/global/gfx';
import { Bound, Vec } from '@blockmind/global/gfx';
import type { PointerEventState } from '@blockmind/std';
import { BaseTool, getTopElements } from '@blockmind/std/gfx';
import { Text } from '@blockmind/store';
import * as Y from 'yjs';

import {
  EdgelessFrameManagerIdentifier,
  type FrameOverlay,
} from './frame-manager';

export class FrameTool extends BaseTool {
  static override toolName = 'frame';

  private _frame: FrameBlockModel | null = null;

  private _startPoint: IVec | null = null;

  get frameManager() {
    return this.std.get(EdgelessFrameManagerIdentifier);
  }

  get frameOverlay() {
    return this.std.get(OverlayIdentifier('frame')) as FrameOverlay;
  }

  private _toModelCoord(p: IPoint): IVec {
    return this.gfx.viewport.toModelCoord(p.x, p.y);
  }

  override dragEnd(): void {
    if (this._frame) {
      const frame = this._frame;
      frame.pop('xywh');
      this.gfx.tool.setTool(DefaultTool);
      this.gfx.selection.set({
        elements: [frame.id],
        editing: false,
      });

      this.frameManager.addElementsToFrame(
        frame,
        getTopElements(this.frameManager.getElementsInFrameBound(frame))
      );
    }

    this._frame = null;
    this._startPoint = null;
    this.frameOverlay.clear();
  }

  override dragMove(e: PointerEventState): void {
    if (!this._startPoint) return;

    const currentPoint = this._toModelCoord(e.point);
    if (Vec.dist(this._startPoint, currentPoint) < 8 && !this._frame) return;

    if (!this._frame) {
      const frames = this.gfx.layer.blocks.filter(
        block => block.flavour === 'polymind:frame'
      ) as FrameBlockModel[];

      const props = this.std
        .get(EditPropsStore)
        .applyLastProps('polymind:frame', {
          title: new Text(new Y.Text(`Frame ${frames.length + 1}`)),
          xywh: Bound.fromPoints([this._startPoint, currentPoint]).serialize(),
          index: this.gfx.layer.generateIndex(true),
          presentationIndex: this.frameManager.generatePresentationIndex(),
        });

      const id = this.doc.addBlock('polymind:frame', props, this.gfx.surface);

      this._frame = this.gfx.getElementById(id) as FrameBlockModel;
      this._frame.stash('xywh');
      return;
    }

    this.gfx.doc.updateBlock(this._frame, {
      xywh: Bound.fromPoints([this._startPoint, currentPoint]).serialize(),
    });

    this.frameOverlay.highlight(this._frame, true);
  }

  override dragStart(e: PointerEventState): void {
    this.doc.captureSync();
    const { point } = e;
    this._startPoint = this._toModelCoord(point);
  }
}
