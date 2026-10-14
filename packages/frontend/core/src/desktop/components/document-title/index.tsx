import { WorkbenchService } from '@polycanvas/core/modules/workbench';
import { useLiveData, useService } from '@toeverything/infra';
import { useEffect } from 'react';

export const DocumentTitle = () => {
  const workbenchService = useService(WorkbenchService);
  const workbenchView = useLiveData(workbenchService.workbench.activeView$);
  const viewTitle = useLiveData(workbenchView.title$);

  useEffect(() => {
    document.title = viewTitle ? `${viewTitle} · PolyCanvas` : 'PolyCanvas';

    return () => {
      document.title = 'PolyCanvas';
    };
  }, [viewTitle]);

  return null;
};
