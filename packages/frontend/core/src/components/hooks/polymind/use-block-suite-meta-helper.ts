import { useAsyncCallback } from '@polycanvas/core/components/hooks/polymind-async-hooks';
import { DocsService } from '@polycanvas/core/modules/doc';
import { WorkspaceService } from '@polycanvas/core/modules/workspace';
import { useService } from '@toeverything/infra';
import { useCallback } from 'react';

import { useNavigateHelper } from '../use-navigate-helper';

export function useBlockSuiteMetaHelper() {
  const workspace = useService(WorkspaceService).workspace;
  const { openPage } = useNavigateHelper();
  const docsService = useService(DocsService);
  const docRecordList = useService(DocsService).list;

  // TODO-Doma
  // "Remove" may cause ambiguity here. Consider renaming as "moveToTrash".
  const removeToTrash = useCallback(
    (docId: string) => {
      const docRecord = docRecordList.doc$(docId).value;
      if (docRecord) {
        docRecord.moveToTrash();
      }
    },
    [docRecordList]
  );

  const restoreFromTrash = useCallback(
    (docId: string) => {
      const docRecord = docRecordList.doc$(docId).value;
      if (docRecord) {
        docRecord.restoreFromTrash();
      }
    },
    [docRecordList]
  );

  const permanentlyDeletePage = useCallback(
    async (pageId: string) => {
      // Cascade-delete any meeting recordings associated with this doc
      // (records + audio files on disk). Best-effort — doc deletion
      // proceeds even if cleanup fails.
      if (BUILD_CONFIG.isElectron) {
        try {
          const { apis } = await import('@polycanvas/electron-api');
          await apis?.recording.deleteMeetingsForDoc(pageId);
        } catch (err) {
          console.warn('Failed to cleanup meetings for deleted doc:', err);
        }
      }
      workspace.docCollection.removeDoc(pageId);
    },
    [workspace]
  );

  const duplicate = useAsyncCallback(
    async (pageId: string, openPageAfterDuplication: boolean = true) => {
      const newPageId = await docsService.duplicate(pageId);
      openPageAfterDuplication &&
        openPage(workspace.docCollection.id, newPageId);
    },
    [docsService, openPage, workspace.docCollection.id]
  );

  return {
    removeToTrash,
    restoreFromTrash,
    permanentlyDeletePage,

    duplicate,
  };
}
