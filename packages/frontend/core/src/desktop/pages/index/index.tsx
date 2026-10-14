import { DesktopApiService } from '@polycanvas/core/modules/desktop-api';
import { WorkspacesService } from '@polycanvas/core/modules/workspace';
import { DEFAULT_WORKSPACE_NAME } from '@polycanvas/env/constant';
import {
  useLiveData,
  useService,
  useServiceOptional,
} from '@toeverything/infra';
import { type ReactNode, useEffect, useLayoutEffect, useRef } from 'react';

import {
  RouteLogic,
  useNavigateHelper,
} from '../../../components/hooks/use-navigate-helper';
import { AppContainer } from '../../components/app-container';

/**
 * PolyCanvas landing route.
 *
 * There is no welcome screen and no docs list: make sure a local workspace
 * exists (creating one silently on first launch) and go straight to its
 * `/canvas` route, which opens the last canvas or creates a new one.
 */
export const Component = ({
  defaultIndexRoute = 'canvas',
  fallback,
}: {
  defaultIndexRoute?: string;
  children?: ReactNode;
  fallback?: ReactNode;
}) => {
  const workspacesService = useService(WorkspacesService);
  const list = useLiveData(workspacesService.list.workspaces$);
  const listIsLoading = useLiveData(workspacesService.list.isRevalidating$);

  const { openPage } = useNavigateHelper();

  // Always clear last workspace id — we always start fresh with local only
  useLayoutEffect(() => {
    localStorage.removeItem('last_workspace_id');
  }, []);

  const creatingRef = useRef(false);

  useEffect(() => {
    if (listIsLoading) {
      return;
    }

    // Filter to local workspaces only
    const localList = list.filter(w => w.flavour === 'local');

    if (localList.length > 0) {
      // Open the first local workspace
      openPage(localList[0].id, defaultIndexRoute, RouteLogic.REPLACE);
      return;
    }

    // No local workspace yet: create one silently and enter it.
    if (creatingRef.current) return;
    creatingRef.current = true;

    workspacesService
      .create('local', async docCollection => {
        docCollection.meta.initialize();
        docCollection.doc.getMap('meta').set('name', DEFAULT_WORKSPACE_NAME);
      })
      .then(meta => {
        openPage(meta.id, defaultIndexRoute, RouteLogic.REPLACE);
      })
      .catch(err => {
        console.error('Failed to create local workspace', err);
        creatingRef.current = false;
      });
  }, [list, openPage, listIsLoading, defaultIndexRoute, workspacesService]);

  const desktopApi = useServiceOptional(DesktopApiService);

  useEffect(() => {
    desktopApi?.handler.ui.pingAppLayoutReady().catch(console.error);
  }, [desktopApi]);

  return fallback ?? <AppContainer fallback />;
};
