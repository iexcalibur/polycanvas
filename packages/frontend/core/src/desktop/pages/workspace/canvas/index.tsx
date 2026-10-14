import { PageDetailLoading } from '@polycanvas/component/page-detail-skeleton';
import { DocsService } from '@polycanvas/core/modules/doc';
import { ViewBody, WorkbenchService } from '@polycanvas/core/modules/workbench';
import { useLiveData, useService } from '@toeverything/infra';
import { useEffect, useRef } from 'react';

/**
 * PolyCanvas landing view inside a workspace (`/workspace/:id/canvas`).
 *
 * Opens the most recently updated canvas, or creates a new one when the
 * workspace is empty, then replaces itself in the view history so Back does
 * not return here.
 */
export const Component = () => {
  const docsService = useService(DocsService);
  const workbench = useService(WorkbenchService).workbench;
  const ready = useLiveData(docsService.list.isReady$);
  const doneRef = useRef(false);

  useEffect(() => {
    if (!ready || doneRef.current) return;
    doneRef.current = true;

    const latest = docsService.list.docs$.value
      .filter(doc => !doc.meta$.value.trash)
      .sort(
        (a, b) =>
          (b.meta$.value.updatedDate ?? 0) - (a.meta$.value.updatedDate ?? 0)
      )[0];

    const target = latest ?? docsService.createDoc({ primaryMode: 'edgeless' });

    workbench.openDoc(
      { docId: target.id, mode: 'edgeless' },
      { at: 'active', replaceHistory: true }
    );
  }, [ready, docsService, workbench]);

  return (
    <ViewBody>
      <PageDetailLoading />
    </ViewBody>
  );
};
