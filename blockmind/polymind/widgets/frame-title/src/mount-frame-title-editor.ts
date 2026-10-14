import { DefaultTool } from '@blockmind/polymind-block-surface';
import type { FrameBlockModel } from '@blockmind/polymind-model';
import { BlockMindError } from '@blockmind/global/exceptions';
import type { BlockComponent } from '@blockmind/std';
import { GfxControllerIdentifier } from '@blockmind/std/gfx';

import { EdgelessFrameTitleEditor } from './edgeless-frame-title-editor';

export function mountFrameTitleEditor(
  frame: FrameBlockModel,
  edgeless: BlockComponent
) {
  const mountElm = edgeless.querySelector('.edgeless-mount-point');
  if (!mountElm) {
    throw new BlockMindError(
      BlockMindError.ErrorCode.ValueNotExists,
      "edgeless block's mount point does not exist"
    );
  }

  const gfx = edgeless.std.get(GfxControllerIdentifier);

  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({
    elements: [frame.id],
    editing: true,
  });

  const frameEditor = new EdgelessFrameTitleEditor();
  frameEditor.frameModel = frame;
  frameEditor.edgeless = edgeless;

  mountElm.append(frameEditor);
}
