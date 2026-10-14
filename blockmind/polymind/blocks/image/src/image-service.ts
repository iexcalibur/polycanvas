import { SurfaceBlockModel } from '@blockmind/polymind-block-surface';
import { FileDropConfigExtension } from '@blockmind/polymind-components/drop-indicator';
import { ImageBlockSchema, MAX_IMAGE_WIDTH } from '@blockmind/polymind-model';
import {
  isInsideEdgelessEditor,
  matchModels,
} from '@blockmind/polymind-shared/utils';
import { GfxControllerIdentifier } from '@blockmind/std/gfx';

import { addImages, addSiblingImageBlocks } from './utils.js';

export const ImageDropOption = FileDropConfigExtension({
  flavour: ImageBlockSchema.model.flavour,
  onDrop: ({ files, targetModel, placement, point, std }) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    if (!imageFiles.length) return false;

    if (targetModel && !matchModels(targetModel, [SurfaceBlockModel])) {
      addSiblingImageBlocks(std, imageFiles, targetModel, placement).catch(
        console.error
      );
      return true;
    }

    if (isInsideEdgelessEditor(std.host)) {
      const gfx = std.get(GfxControllerIdentifier);
      point = gfx.viewport.toViewCoordFromClientCoord(point);
      addImages(std, files, { point, maxWidth: MAX_IMAGE_WIDTH })
        .then(() => {})
        .catch(console.error);

      return true;
    }

    return false;
  },
});
