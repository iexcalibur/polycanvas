import {
  NoPermissionOrNotFound,
  NotFoundPage,
} from '@polycanvas/component/not-found-page';
import { DesktopApiService } from '@polycanvas/core/modules/desktop-api';
import { useServiceOptional } from '@toeverything/infra';
import type { ReactElement } from 'react';
import { useCallback, useEffect } from 'react';

import {
  RouteLogic,
  useNavigateHelper,
} from '../../../components/hooks/use-navigate-helper';

/**
 * only for web, should not be used in electron
 */
export const PageNotFound = ({
  noPermission,
}: {
  noPermission?: boolean;
}): ReactElement => {
  const desktopApi = useServiceOptional(DesktopApiService);

  const { jumpToIndex } = useNavigateHelper();

  const handleBackButtonClick = useCallback(
    () => jumpToIndex(RouteLogic.REPLACE),
    [jumpToIndex]
  );

  useEffect(() => {
    desktopApi?.handler.ui.pingAppLayoutReady().catch(console.error);
  }, [desktopApi]);

  return noPermission ? (
    <NoPermissionOrNotFound
      user={null}
      onBack={handleBackButtonClick}
      onSignOut={() => {}}
      signInComponent={null}
    />
  ) : (
    <NotFoundPage
      user={null}
      onBack={handleBackButtonClick}
      onSignOut={() => {}}
    />
  );
};

export const Component = () => {
  return <PageNotFound />;
};
