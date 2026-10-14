import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blockmind/polymind/ext-loader';
import { z } from 'zod';

import { patchDatabaseBlockConfigService } from './database-block-config-service';

const optionsSchema = z.object({});

export type PolymindDatabaseViewOptions = z.infer<typeof optionsSchema>;

export class PolymindDatabaseViewExtension extends ViewExtensionProvider<PolymindDatabaseViewOptions> {
  override name = 'polymind-database-view';

  override schema = optionsSchema;

  override setup(
    context: ViewExtensionContext,
    options?: PolymindDatabaseViewOptions
  ) {
    super.setup(context, options);

    context.register(patchDatabaseBlockConfigService());
  }
}
