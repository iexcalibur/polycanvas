import { createTextActions } from '@blockmind/polymind-gfx-text';
import { EdgelessTextBlockModel } from '@blockmind/polymind-model';
import {
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@blockmind/polymind-shared/services';
import { BlockFlavourIdentifier } from '@blockmind/std';

export const edgelessTextToolbarConfig = {
  // No need to adjust element bounds, which updates itself using ResizeObserver
  actions: createTextActions(EdgelessTextBlockModel, 'edgeless-text'),

  when: ctx => ctx.getSurfaceModelsByType(EdgelessTextBlockModel).length > 0,
} as const satisfies ToolbarModuleConfig;

export const edgelessTextToolbarExtension = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('polymind:surface:edgeless-text'),
  config: edgelessTextToolbarConfig,
});
