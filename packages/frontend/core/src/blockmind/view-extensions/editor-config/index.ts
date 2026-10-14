import { getEditorConfigExtension } from '@polycanvas/core/blockmind/view-extensions/editor-config/get-config';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blockmind/polymind/ext-loader';
import { FrameworkProvider } from '@toeverything/infra';
import { z } from 'zod';

const optionsSchema = z.object({
  framework: z.instanceof(FrameworkProvider).optional(),
});

type PolymindEditorConfigViewOptions = z.infer<typeof optionsSchema>;

export class PolymindEditorConfigViewExtension extends ViewExtensionProvider<PolymindEditorConfigViewOptions> {
  override name = 'polymind-view-editor-config';

  override schema = optionsSchema;

  override setup(
    context: ViewExtensionContext,
    options?: PolymindEditorConfigViewOptions
  ) {
    super.setup(context, options);
    const framework = options?.framework;
    if (!framework) {
      return;
    }

    if (context.scope === 'edgeless' || context.scope === 'page') {
      context.register(getEditorConfigExtension(framework));
    }
  }
}
