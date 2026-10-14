import { FileDropExtension } from '@blockmind/polymind-components/drop-indicator';
import {
  PeekViewExtension,
  type PeekViewService,
} from '@blockmind/polymind-components/peek';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blockmind/polymind-ext-loader';
import {
  AutoClearSelectionService,
  CitationService,
  DefaultOpenDocExtension,
  DNDAPIExtension,
  DocDisplayMetaService,
  DocModeService,
  EditPropsStore,
  EmbedOptionService,
  FileSizeLimitService,
  FontConfigExtension,
  fontConfigSchema,
  FontLoaderService,
  LinkPreviewCache,
  LinkPreviewCacheConfigSchema,
  LinkPreviewCacheExtension,
  LinkPreviewService,
  PageViewportServiceExtension,
  ThemeService,
  ToolbarRegistryExtension,
} from '@blockmind/polymind-shared/services';
import { InteractivityManager, ToolController } from '@blockmind/std/gfx';
import { z } from 'zod';

import { clipboardConfigs } from './clipboard';
import { effects } from './effects';

const optionsSchema = z.object({
  linkPreviewCacheConfig: z.optional(LinkPreviewCacheConfigSchema),
  fontConfig: z.optional(z.array(fontConfigSchema)),
  peekView: z.optional(z.custom<PeekViewService>()),
});

export type FoundationViewExtensionOptions = z.infer<typeof optionsSchema>;

export class FoundationViewExtension extends ViewExtensionProvider<FoundationViewExtensionOptions> {
  override name = 'foundation';

  override schema = optionsSchema;

  override effect() {
    super.effect();
    effects();
  }

  override setup(
    context: ViewExtensionContext,
    options?: FoundationViewExtensionOptions
  ) {
    super.setup(context, options);
    context.register([
      DocDisplayMetaService,
      EditPropsStore,
      DefaultOpenDocExtension,
      FontLoaderService,

      DocModeService,
      ThemeService,
      EmbedOptionService,
      PageViewportServiceExtension,
      DNDAPIExtension,
      FileDropExtension,
      ToolbarRegistryExtension,
      AutoClearSelectionService,
      FileSizeLimitService,
      LinkPreviewCache,
      LinkPreviewService,
      CitationService,
    ]);
    context.register(clipboardConfigs);
    if (this.isEdgeless(context.scope)) {
      context.register([InteractivityManager, ToolController]);
    }
    const fontConfig = options?.fontConfig;
    if (fontConfig) {
      context.register(FontConfigExtension(fontConfig));
    }
    const linkPreviewCacheConfig = options?.linkPreviewCacheConfig;
    if (linkPreviewCacheConfig) {
      context.register(LinkPreviewCacheExtension(linkPreviewCacheConfig));
    }
    const peekView = options?.peekView;
    if (peekView) {
      context.register(PeekViewExtension(peekView));
    }
  }
}
