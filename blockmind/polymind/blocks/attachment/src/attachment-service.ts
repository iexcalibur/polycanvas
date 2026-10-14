import { SurfaceBlockModel } from '@blockmind/polymind-block-surface';
import { FileDropConfigExtension } from '@blockmind/polymind-components/drop-indicator';
import { AttachmentBlockSchema } from '@blockmind/polymind-model';
import {
  isInsideEdgelessEditor,
  matchModels,
} from '@blockmind/polymind-shared/utils';
import { GfxControllerIdentifier } from '@blockmind/std/gfx';

import { addAttachments, addSiblingAttachmentBlocks } from './utils.js';

export const AttachmentDropOption = FileDropConfigExtension({
  flavour: AttachmentBlockSchema.model.flavour,
  onDrop: ({ files, targetModel, placement, point, std }) => {
    // generic attachment block for all files except images
    const attachmentFiles = files.filter(
      file => !file.type.startsWith('image/')
    );
    if (!attachmentFiles.length) return false;

    if (targetModel && !matchModels(targetModel, [SurfaceBlockModel])) {
      addSiblingAttachmentBlocks(
        std,
        attachmentFiles,
        targetModel,
        placement
      ).catch(console.error);

      return true;
    }

    if (isInsideEdgelessEditor(std.host)) {
      const gfx = std.get(GfxControllerIdentifier);
      point = gfx.viewport.toViewCoordFromClientCoord(point);
      addAttachments(std, attachmentFiles, point).catch(console.error);

      return true;
    }

    return false;
  },
});
