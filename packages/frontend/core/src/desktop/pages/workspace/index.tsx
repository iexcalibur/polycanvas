import { DNDContext } from '@polycanvas/component';
import { GlobalDialogService } from '@polycanvas/core/modules/dialogs';
import { DndService } from '@polycanvas/core/modules/dnd/services';
import { GlobalContextService } from '@polycanvas/core/modules/global-context';
import { OpenInAppGuard } from '@polycanvas/core/modules/open-in-app';
import {
  getPolyMindWorkspaceSchema,
  type Workspace,
  type WorkspaceMetadata,
  WorkspacesService,
} from '@polycanvas/core/modules/workspace';
import { ZipTransformer } from '@blockmind/polymind/widgets/linked-doc';
import {
  FrameworkScope,
  LiveData,
  useLiveData,
  useService,
  useServices,
} from '@toeverything/infra';
import type { PropsWithChildren, ReactElement } from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { map } from 'rxjs';
import * as _Y from 'yjs';

import { PolymindErrorBoundary } from '../../../components/polymind/polymind-error-boundary';
import { useNavigateHelper } from '../../../components/hooks/use-navigate-helper';
import { WorkbenchRoot } from '../../../modules/workbench';
import { AppContainer } from '../../components/app-container';
import { WorkspaceLayout } from './layouts/workspace-layout';

declare global {
  /**
   * @internal debug only
   */
  // oxlint-disable-next-line no-var
  var currentWorkspace: Workspace | undefined;
  // oxlint-disable-next-line no-var
  var exportWorkspaceSnapshot: (docs?: string[]) => Promise<void>;
  // oxlint-disable-next-line no-var
  var importWorkspaceSnapshot: () => Promise<void>;
  // oxlint-disable-next-line no-var
  var Y: typeof _Y;
  interface WindowEventMap {
    'polymind:workspace:change': CustomEvent<{ id: string }>;
  }
}

globalThis.Y = _Y;

export const Component = (): ReactElement => {
  const { workspacesService, globalContextService } = useServices({
    WorkspacesService,
    GlobalContextService,
  });

  const params = useParams();

  const [workspaceNotFound, setWorkspaceNotFound] = useState(false);
  const listLoading = useLiveData(workspacesService.list.isRevalidating$);
  const workspaces = useLiveData(workspacesService.list.workspaces$);
  const meta = useMemo(() => {
    return workspaces.find(({ id }) => id === params.workspaceId);
  }, [workspaces, params.workspaceId]);

  // if listLoading is false, we can show 404 page, otherwise we should show loading page.
  useEffect(() => {
    if (listLoading === false && meta === undefined) {
      setWorkspaceNotFound(true);
    }
    if (meta) {
      setWorkspaceNotFound(false);
    }
  }, [listLoading, meta, workspacesService]);

  // if workspace is not found, we should retry
  const retryTimesRef = useRef(3);
  useEffect(() => {
    if (params.workspaceId) {
      retryTimesRef.current = 3; // reset retry times
      workspacesService.list.revalidate();
    }
  }, [params.workspaceId, workspacesService]);
  useEffect(() => {
    if (listLoading === false && meta === undefined) {
      const timer = setTimeout(() => {
        if (retryTimesRef.current > 0) {
          workspacesService.list.revalidate();
          retryTimesRef.current--;
        }
      }, 5000);
      return () => clearTimeout(timer);
    }
    return;
  }, [listLoading, meta, workspaceNotFound, workspacesService]);

  const { jumpToIndex } = useNavigateHelper();
  useEffect(() => {
    if (workspaceNotFound) {
      localStorage.removeItem('last_workspace_id');
      jumpToIndex();
    }
  }, [workspaceNotFound, jumpToIndex]);

  if (!meta || workspaceNotFound) {
    return <AppContainer fallback />;
  }

  return <WorkspacePage meta={meta} />;
};

const DNDContextProvider = ({ children }: PropsWithChildren) => {
  const dndService = useService(DndService);
  const contextValue = useMemo(() => {
    return {
      fromExternalData: dndService.fromExternalData,
      toExternalData: dndService.toExternalData,
    };
  }, [dndService.fromExternalData, dndService.toExternalData]);
  return (
    <DNDContext.Provider value={contextValue}>{children}</DNDContext.Provider>
  );
};

const WorkspacePage = ({ meta }: { meta: WorkspaceMetadata }) => {
  const { workspacesService, globalContextService } = useServices({
    WorkspacesService,
    GlobalContextService,
  });

  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  useLayoutEffect(() => {
    const ref = workspacesService.open({ metadata: meta });
    setWorkspace(ref.workspace);
    return () => {
      ref.dispose();
    };
  }, [meta, workspacesService]);

  const rootDocReady$ = useMemo(
    () =>
      workspace
        ? LiveData.from(
            workspace.engine.doc
              .docState$(workspace.id)
              .pipe(map(v => v.ready)),
            false
          )
        : null,
    [workspace]
  );
  const isRootDocReady = useLiveData(rootDocReady$) ?? false;

  useEffect(() => {
    if (workspace) {
      // for debug purpose
      window.currentWorkspace = workspace ?? undefined;
      window.dispatchEvent(
        new CustomEvent('polymind:workspace:change', {
          detail: {
            id: workspace.id,
          },
        })
      );
      window.exportWorkspaceSnapshot = async (docs?: string[]) => {
        await ZipTransformer.exportDocs(
          workspace.docCollection,
          getPolyMindWorkspaceSchema(),
          Array.from(workspace.docCollection.docs.values())
            .filter(doc => (docs ? docs.includes(doc.id) : true))
            .map(doc => doc.getStore())
        );
      };
      window.importWorkspaceSnapshot = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.zip';
        input.onchange = async () => {
          if (input.files && input.files.length > 0) {
            const file = input.files[0];
            const blob = new Blob([file], { type: 'application/zip' });
            const newDocs = await ZipTransformer.importDocs(
              workspace.docCollection,
              getPolyMindWorkspaceSchema(),
              blob
            );
            console.log(
              'imported docs',
              newDocs
                .filter(doc => !!doc)
                .map(doc => ({
                  id: doc.id,
                  title: doc.meta?.title,
                }))
            );
          }
        };
        input.click();
      };
      globalContextService.globalContext.workspaceId.set(workspace.id);
      globalContextService.globalContext.workspaceFlavour.set(
        workspace.flavour
      );
      return () => {
        window.currentWorkspace = undefined;
        globalContextService.globalContext.workspaceId.set(null);
        globalContextService.globalContext.workspaceFlavour.set(null);
      };
    }
    return;
  }, [globalContextService, workspace]);

  if (!workspace) {
    return null; // skip this, workspace will be set in layout effect
  }

  if (!isRootDocReady) {
    return (
      <FrameworkScope scope={workspace.scope}>
        <DNDContextProvider>
          <OpenInAppGuard>
            <AppContainer fallback />
          </OpenInAppGuard>
        </DNDContextProvider>
      </FrameworkScope>
    );
  }

  return (
    <FrameworkScope scope={workspace.scope}>
      <DNDContextProvider>
        <OpenInAppGuard>
          <PolymindErrorBoundary height="100vh">
            <WorkspaceLayout>
              <WorkbenchRoot />
            </WorkspaceLayout>
          </PolymindErrorBoundary>
        </OpenInAppGuard>
      </DNDContextProvider>
    </FrameworkScope>
  );
};
