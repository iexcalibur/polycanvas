import type { Workspace } from '@polycanvas/core/modules/workspace';
import { useCallback } from 'react';

interface ConfirmEnableCloudOptions {
  onSuccess?: () => void;
  onFinished?: () => void;
  openPageId?: string;
  serverId?: string;
}

export const useEnableCloud = () => {
  const confirmEnableCloud = useCallback(
    (_ws: Workspace, _options?: ConfirmEnableCloudOptions) => {
    },
    []
  );

  return confirmEnableCloud;
};
