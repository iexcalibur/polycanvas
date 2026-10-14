import { ConfigExtensionFactory } from '@blockmind/std';

import type { ToolbarMoreMenuConfig } from './types';

export const ToolbarMoreMenuConfigExtension = ConfigExtensionFactory<
  Partial<ToolbarMoreMenuConfig>
>('polymind-toolbar-more-menu');
