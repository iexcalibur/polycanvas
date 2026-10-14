import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blockmind/polymind/ext-loader';
import { FrameworkProvider } from '@toeverything/infra';
import { z } from 'zod';

const optionsSchema = z.object({
  framework: z.instanceof(FrameworkProvider).optional(),
  enableCloud: z.boolean().optional(),
});

type CloudViewOptions = z.infer<typeof optionsSchema>;

export class CloudViewExtension extends ViewExtensionProvider<CloudViewOptions> {
  override name = 'polymind-view-cloud';

  override schema = optionsSchema;

  override setup(context: ViewExtensionContext, _options?: CloudViewOptions) {
    super.setup(context, _options);
  }
}
