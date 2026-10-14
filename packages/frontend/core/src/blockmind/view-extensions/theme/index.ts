import { getPreviewThemeExtension } from '@polycanvas/core/blockmind/view-extensions/theme/preview-theme';
import { getThemeExtension } from '@polycanvas/core/blockmind/view-extensions/theme/theme';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blockmind/polymind/ext-loader';
import { FrameworkProvider } from '@toeverything/infra';
import { z } from 'zod';

const optionsSchema = z.object({
  framework: z.instanceof(FrameworkProvider).optional(),
});

type PolymindThemeViewOptions = z.infer<typeof optionsSchema>;

export class PolymindThemeViewExtension extends ViewExtensionProvider<PolymindThemeViewOptions> {
  override name = 'polymind-view-theme';

  override schema = optionsSchema;

  override setup(
    context: ViewExtensionContext,
    options?: PolymindThemeViewOptions
  ) {
    super.setup(context, options);
    const framework = options?.framework;
    if (!framework) {
      return;
    }

    if (this.isPreview(context.scope)) {
      context.register(getPreviewThemeExtension(framework));
    } else {
      context.register(getThemeExtension(framework));
    }
  }
}
