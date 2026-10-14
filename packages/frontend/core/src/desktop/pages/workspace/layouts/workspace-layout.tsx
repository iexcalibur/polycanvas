import { uniReactRoot } from '@polycanvas/component';
import { useResponsiveSidebar } from '@polycanvas/core/components/hooks/use-responsive-siedebar';
import { SWRConfigProvider } from '@polycanvas/core/components/providers/swr-config-provider';
import { WorkspaceSideEffects } from '@polycanvas/core/components/providers/workspace-side-effects';
import { AppContainer } from '@polycanvas/core/desktop/components/app-container';
import { DocumentTitle } from '@polycanvas/core/desktop/components/document-title';
import { WorkspaceDialogs } from '@polycanvas/core/desktop/dialogs';
import { PeekViewManagerModal } from '@polycanvas/core/modules/peek-view';
import { WorkbenchService } from '@polycanvas/core/modules/workbench';
import { LiveData, useLiveData, useService } from '@toeverything/infra';
import type { PropsWithChildren } from 'react';

export const WorkspaceLayout = function WorkspaceLayout({
  children,
}: PropsWithChildren) {
  return (
    <SWRConfigProvider>
      <WorkspaceDialogs />

      {/* ---- some side-effect components ---- */}
      <WorkspaceSideEffects />
      <PeekViewManagerModal />
      <DocumentTitle />

      <WorkspaceLayoutInner>{children}</WorkspaceLayoutInner>
      <uniReactRoot.Root />
    </SWRConfigProvider>
  );
};

/**
 * Wraps the workspace layout main router view
 */
const WorkspaceLayoutUIContainer = ({ children }: PropsWithChildren) => {
  const workbench = useService(WorkbenchService).workbench;
  const currentPath = useLiveData(
    LiveData.computed(get => {
      return get(workbench.basename$) + get(workbench.location$).pathname;
    })
  );
  useResponsiveSidebar();

  return (
    <AppContainer data-current-path={currentPath}>
      {children}
    </AppContainer>
  );
};
const WorkspaceLayoutInner = ({ children }: PropsWithChildren) => {
  return <WorkspaceLayoutUIContainer>{children}</WorkspaceLayoutUIContainer>;
};
