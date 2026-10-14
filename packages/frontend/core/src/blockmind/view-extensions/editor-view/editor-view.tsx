import type { ConfirmModalProps, ElementOrFactory } from '@polycanvas/component';
import {
  PolymindPageReference,
  PolymindSharedPageReference,
} from '@polycanvas/core/components/polymind/reference-link';
import { DocService, DocsService } from '@polycanvas/core/modules/doc';
import { EditorService } from '@polycanvas/core/modules/editor';
import { toDocSearchParams } from '@polycanvas/core/modules/navigation';
import { WorkspaceService } from '@polycanvas/core/modules/workspace';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blockmind/polymind/ext-loader';
import { FrameworkProvider } from '@toeverything/infra';
import type { TemplateResult } from 'lit';
import { z } from 'zod';

import { patchForAudioEmbedView } from './audio/audio-view';
import { buildDocDisplayMetaExtension } from './display-meta';
import { patchDocModeService } from './doc-mode-service';
import { patchDocUrlExtensions } from './doc-url';
import { patchFileSizeLimitExtension } from './file-size-limit';
import { patchNotificationService } from './notification-service';
import { patchOpenDocExtension } from './open-doc';
import { patchQuickSearchService } from './quick-search-service';
import {
  patchReferenceRenderer,
  type ReferenceReactRenderer,
} from './reference-renderer';
import { patchSideBarService } from './side-bar-service';

const optionsSchema = z.object({
  // services
  framework: z.instanceof(FrameworkProvider),

  // react renderer
  reactToLit: z
    .function()
    .args(z.custom<ElementOrFactory>(), z.boolean().optional())
    .returns(z.custom<TemplateResult>()),
  confirmModal: z.object({
    openConfirmModal: z
      .function()
      .args(z.custom<ConfirmModalProps>().optional(), z.any().optional()),
    closeConfirmModal: z.function(),
  }),

  scope: z.enum(['doc', 'workspace']).optional(),
});

export type PolymindEditorViewOptions = z.infer<typeof optionsSchema>;

export class PolymindEditorViewExtension extends ViewExtensionProvider<PolymindEditorViewOptions> {
  override name = 'polymind-editor-view';

  override schema = optionsSchema;

  private readonly _getCustomReferenceRenderer = (
    framework: FrameworkProvider
  ): ReferenceReactRenderer => {
    const workspaceService = framework.get(WorkspaceService);
    return function customReference(reference) {
      const data = reference.delta.attributes?.reference;
      if (!data) return <span />;

      const pageId = data.pageId;
      if (!pageId) return <span />;

      // title alias
      const title = data.title;
      const params = toDocSearchParams(data.params);

      if (workspaceService.workspace.openOptions.isSharedMode) {
        return (
          <PolymindSharedPageReference
            docCollection={workspaceService.workspace.docCollection}
            pageId={pageId}
            params={params}
            title={title}
          />
        );
      }

      return (
        <PolymindPageReference pageId={pageId} params={params} title={title} />
      );
    };
  };

  override setup(
    context: ViewExtensionContext,
    options?: PolymindEditorViewOptions
  ) {
    super.setup(context, options);
    if (!options) {
      return;
    }
    const { framework, reactToLit, confirmModal, scope = 'doc' } = options;

    const referenceRenderer = this._getCustomReferenceRenderer(framework);

    context
      .register([
        patchReferenceRenderer(reactToLit, referenceRenderer),
        patchNotificationService(confirmModal),
        patchOpenDocExtension(),
        patchSideBarService(framework),
        patchFileSizeLimitExtension(framework),
        buildDocDisplayMetaExtension(framework),
        patchForAudioEmbedView(reactToLit),
      ])
      .register(patchDocUrlExtensions(framework))
      .register(patchQuickSearchService(framework));

    if (scope === 'doc') {
      const docService = framework.get(DocService);
      const docsService = framework.get(DocsService);
      const editorService = framework.get(EditorService);
      context.register([
        patchDocModeService(docService, docsService, editorService),
      ]);
    }
  }
}
