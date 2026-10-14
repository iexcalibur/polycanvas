import { ConfigExtensionFactory } from '@blockmind/std';

import type { DatabaseViewExtensionOptions } from './view';

export const DatabaseConfigExtension =
  ConfigExtensionFactory<DatabaseViewExtensionOptions>('polymind:database');
