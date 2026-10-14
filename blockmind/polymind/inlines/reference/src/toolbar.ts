import { ToolbarModuleExtension } from '@blockmind/polymind-shared/services';
import { BlockFlavourIdentifier } from '@blockmind/std';

import { builtinInlineReferenceToolbarConfig } from './reference-node/configs/toolbar';

export const referenceNodeToolbar = ToolbarModuleExtension({
  id: BlockFlavourIdentifier('polymind:reference'),
  config: builtinInlineReferenceToolbarConfig,
});
