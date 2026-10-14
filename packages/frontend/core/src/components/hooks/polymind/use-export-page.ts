import { notify } from '@polycanvas/component';
import {
  pushGlobalLoadingEventAtom,
  resolveGlobalLoadingEventAtom,
} from '@polycanvas/component/global-loading';
import type { PolymindEditorContainer } from '@polycanvas/core/blockmind/block-suite-editor/blockmind-editor';
import { EditorService } from '@polycanvas/core/modules/editor';
import { getPolyMindWorkspaceSchema } from '@polycanvas/core/modules/workspace/global-schema';
import { useI18n } from '@polycanvas/i18n';
import { ExportManager } from '@blockmind/polymind/blocks/surface';
import {
  docLinkBaseURLMiddleware,
  embedSyncedDocMiddleware,
  HtmlAdapterFactoryIdentifier,
  MarkdownAdapterFactoryIdentifier,
  titleMiddleware,
} from '@blockmind/polymind/shared/adapters';
import { printToPdf } from '@blockmind/polymind/shared/utils';
import type { BlockStdScope } from '@blockmind/polymind/std';
import { type Store, Transformer } from '@blockmind/polymind/store';
import {
  createAssetsArchive,
  download,
  HtmlTransformer,
  MarkdownTransformer,
  ZipTransformer,
} from '@blockmind/polymind/widgets/linked-doc';
import { useLiveData, useService } from '@toeverything/infra';
import { useSetAtom } from 'jotai';
import { nanoid } from 'nanoid';

import { useAsyncCallback } from '../polymind-async-hooks';

type ExportType =
  | 'pdf'
  | 'html'
  | 'png'
  | 'markdown'
  | 'snapshot'
  | 'pdf-export';

interface ExportHandlerOptions {
  page: Store;
  editorContainer: PolymindEditorContainer;
  type: ExportType;
}

interface AdapterResult {
  file: string;
  assetsIds: string[];
}

type AdapterFactoryIdentifier =
  | typeof HtmlAdapterFactoryIdentifier
  | typeof MarkdownAdapterFactoryIdentifier;

interface AdapterConfig {
  identifier: AdapterFactoryIdentifier;
  fileExtension: string; // file extension need to be lower case with dot prefix, e.g. '.md', '.txt', '.html'
  contentType: string;
  indexFileName: string;
}

async function exportDoc(
  doc: Store,
  std: BlockStdScope,
  config: AdapterConfig
) {
  const transformer = new Transformer({
    schema: getPolyMindWorkspaceSchema(),
    blobCRUD: doc.workspace.blobSync,
    docCRUD: {
      create: (id: string) => doc.workspace.createDoc(id).getStore({ id }),
      get: (id: string) => doc.workspace.getDoc(id)?.getStore({ id }) ?? null,
      delete: (id: string) => doc.workspace.removeDoc(id),
    },
    middlewares: [
      docLinkBaseURLMiddleware(doc.workspace.id),
      titleMiddleware(doc.workspace.meta.docMetas),
      embedSyncedDocMiddleware('content'),
    ],
  });

  const adapterFactory = std.store.provider.get(config.identifier);
  const adapter = adapterFactory.get(transformer);
  const result = (await adapter.fromDoc(doc)) as AdapterResult;

  if (!result || (!result.file && !result.assetsIds.length)) {
    return;
  }

  const docTitle = doc.meta?.title || 'Untitled';
  const contentBlob = new Blob([result.file], { type: config.contentType });

  let downloadBlob: Blob;
  let name: string;

  if (result.assetsIds.length > 0) {
    if (!transformer.assets) {
      throw new Error('No assets found');
    }
    const zip = await createAssetsArchive(transformer.assets, result.assetsIds);
    await zip.file(config.indexFileName, contentBlob);
    downloadBlob = await zip.generate();
    name = `${docTitle}.zip`;
  } else {
    downloadBlob = contentBlob;
    name = `${docTitle}${config.fileExtension}`;
  }

  download(downloadBlob, name);
}

async function exportToHtml(doc: Store, std?: BlockStdScope) {
  if (!std) {
    // If std is not provided, we use the default export method
    await HtmlTransformer.exportDoc(doc);
  } else {
    await exportDoc(doc, std, {
      identifier: HtmlAdapterFactoryIdentifier,
      fileExtension: '.html',
      contentType: 'text/html',
      indexFileName: 'index.html',
    });
  }
}

async function exportToMarkdown(doc: Store, std?: BlockStdScope) {
  if (!std) {
    // If std is not provided, we use the default export method
    await MarkdownTransformer.exportDoc(doc);
  } else {
    await exportDoc(doc, std, {
      identifier: MarkdownAdapterFactoryIdentifier,
      fileExtension: '.md',
      contentType: 'text/plain',
      indexFileName: 'index.md',
    });
  }
}

async function exportHandler({
  page,
  type,
  editorContainer,
}: ExportHandlerOptions) {
  const editorRoot = document.querySelector('editor-host');
  switch (type) {
    case 'html':
      await exportToHtml(page, editorRoot?.std);
      return;
    case 'markdown':
      await exportToMarkdown(page, editorRoot?.std);
      return;
    case 'snapshot':
      await ZipTransformer.exportDocs(
        page.workspace,
        getPolyMindWorkspaceSchema(),
        [page]
      );
      return;
    case 'pdf':
      await printToPdf(editorContainer);
      return;
    case 'png': {
      await editorRoot?.std.get(ExportManager).exportPng();
      return;
    }
    case 'pdf-export': {
      console.warn('PDF export not available');
      return;
    }
  }
}

export const useExportPage = () => {
  const editor = useService(EditorService).editor;
  const editorContainer = useLiveData(editor.editorContainer$);
  const blockmindDoc = editor.doc.blockSuiteDoc;
  const pushGlobalLoadingEvent = useSetAtom(pushGlobalLoadingEventAtom);
  const resolveGlobalLoadingEvent = useSetAtom(resolveGlobalLoadingEventAtom);
  const t = useI18n();

  const onClickHandler = useAsyncCallback(
    async (type: ExportType) => {
      if (editorContainer === null) return;

      // editor container is wrapped by a proxy, we need to get the origin
      const originEditorContainer = (editorContainer as any)
        .origin as PolymindEditorContainer;

      const globalLoadingID = nanoid();
      pushGlobalLoadingEvent({
        key: globalLoadingID,
      });
      try {
        await exportHandler({
          page: blockmindDoc,
          type,
          editorContainer: originEditorContainer,
        });
        notify.success({
          title: t['com.polymind.export.success.title'](),
          message: t['com.polymind.export.success.message'](),
        });
      } catch (err) {
        console.error(err);
        notify.error({
          title: t['com.polymind.export.error.title'](),
          message: t['com.polymind.export.error.message'](),
        });
      } finally {
        resolveGlobalLoadingEvent(globalLoadingID);
      }
    },
    [
      blockmindDoc,
      editorContainer,
      pushGlobalLoadingEvent,
      resolveGlobalLoadingEvent,
      t,
    ]
  );

  return onClickHandler;
};
