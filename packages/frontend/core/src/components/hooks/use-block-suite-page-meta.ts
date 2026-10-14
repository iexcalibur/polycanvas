import { DocsService } from '@polycanvas/core/modules/doc';
import type { DocMeta, Workspace } from '@blockmind/polymind/store';
import { useService } from '@toeverything/infra';
import { useCallback, useMemo } from 'react';

import { useAsyncCallback } from './polymind-async-hooks';
import { useAllBlockSuiteDocMeta } from './use-all-block-suite-page-meta';

/**
 * Get all pageMetas (journals no longer exist in PolyCanvas).
 */
export function useBlockSuiteDocMeta(docCollection: Workspace) {
  return useAllBlockSuiteDocMeta(docCollection);
}

export function useDocMetaHelper() {
  const docsService = useService(DocsService);

  const setDocTitle = useAsyncCallback(
    async (docId: string, newTitle: string) => {
      await docsService.changeDocTitle(docId, newTitle);
    },
    [docsService]
  );

  const setDocMeta = useCallback(
    (docId: string, docMeta: Partial<DocMeta>) => {
      const doc = docsService.list.doc$(docId).value;
      if (doc) {
        doc.setMeta(docMeta);
      }
    },
    [docsService]
  );

  const getDocMeta = useCallback(
    (docId: string) => {
      const doc = docsService.list.doc$(docId).value;
      return doc?.meta$.value;
    },
    [docsService]
  );

  return useMemo(
    () => ({
      setDocTitle,
      setDocMeta,
      getDocMeta,
    }),
    [getDocMeta, setDocMeta, setDocTitle]
  );
}
