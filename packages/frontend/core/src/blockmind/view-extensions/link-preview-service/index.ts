import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blockmind/polymind/ext-loader';
import { FrameworkProvider } from '@toeverything/infra';
import { z } from 'zod';

import { patchLinkPreviewService } from './link-preview-service';

const optionsSchema = z.object({
  framework: z.instanceof(FrameworkProvider).optional(),
});

type PolymindLinkPreviewViewOptions = z.infer<typeof optionsSchema>;

export class PolymindLinkPreviewExtension extends ViewExtensionProvider<PolymindLinkPreviewViewOptions> {
  override name = 'polymind-link-preview-extension';

  override schema = optionsSchema;

  override setup(
    context: ViewExtensionContext,
    options?: PolymindLinkPreviewViewOptions
  ) {
    super.setup(context, options);
    if (!options?.framework) {
      return;
    }
    const { framework } = options;
    context.register(patchLinkPreviewService(framework));
  }
}
