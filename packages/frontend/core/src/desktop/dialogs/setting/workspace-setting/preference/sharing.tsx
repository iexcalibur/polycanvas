import { WorkspaceService } from '@polycanvas/core/modules/workspace';
import { useService } from '@toeverything/infra';

export const SharingPanel = () => {
  const workspace = useService(WorkspaceService).workspace;
  if (workspace.flavour === 'local') {
    return null;
  }
  return null;
};
