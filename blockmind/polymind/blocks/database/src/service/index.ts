import type { PropertyMetaConfig } from '@blockmind/data-view';
import { createIdentifier } from '@blockmind/global/di';

export interface DatabaseBlockConfigService {
  propertiesPresets: PropertyMetaConfig[];
}

export const DatabaseBlockConfigService =
  createIdentifier<DatabaseBlockConfigService>(
    'PolymindDatabaseBlockConfigService'
  );
