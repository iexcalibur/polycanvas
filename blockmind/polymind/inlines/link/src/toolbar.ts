import { ToolbarModuleExtension } from '@blockmind/polymind-shared/services';
import { BlockFlavourIdentifier } from '@blockmind/std';

import { builtinInlineLinkToolbarConfig } from './link-node/configs/toolbar.js';

export const linkToolbar = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('polymind:link'),
  config: builtinInlineLinkToolbarConfig,
});
