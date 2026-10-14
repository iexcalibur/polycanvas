import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blockmind/polymind/ext-loader';
import { FrameworkProvider } from '@toeverything/infra';
import { z } from 'zod';

import { patchIconPickerService } from './icon-picker-service';

const optionsSchema = z.object({
  framework: z.instanceof(FrameworkProvider).optional(),
});

type PolymindIconPickerViewOptions = z.infer<typeof optionsSchema>;

export class PolymindIconPickerExtension extends ViewExtensionProvider<PolymindIconPickerViewOptions> {
  override name = 'polymind-icon-picker-extension';

  override schema = optionsSchema;

  override setup(
    context: ViewExtensionContext,
    options?: PolymindIconPickerViewOptions
  ) {
    super.setup(context, options);
    if (!options?.framework) {
      return;
    }
    const { framework } = options;
    context.register(patchIconPickerService(framework));
  }
}
