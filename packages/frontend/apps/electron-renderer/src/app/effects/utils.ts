import { FeatureFlagService } from '@polycanvas/core/modules/feature-flag';
import { GlobalContextService } from '@polycanvas/core/modules/global-context';
import { WorkspacesService } from '@polycanvas/core/modules/workspace';
import type { FrameworkProvider } from '@toeverything/infra';

export function getCurrentWorkspace(frameworkProvider: FrameworkProvider) {
  const currentWorkspaceId = frameworkProvider
    .get(GlobalContextService)
    .globalContext.workspaceId.get();
  const workspacesService = frameworkProvider.get(WorkspacesService);
  const workspaceRef = currentWorkspaceId
    ? workspacesService.openByWorkspaceId(currentWorkspaceId)
    : null;
  if (!workspaceRef) {
    return;
  }
  const { workspace, dispose } = workspaceRef;

  return {
    workspace,
    dispose,
    [Symbol.dispose]: dispose,
  };
}

export function getCurrentServerService(_frameworkProvider: FrameworkProvider) {
  return null;
}

export function isAiEnabled(frameworkProvider: FrameworkProvider) {
  const featureFlagService = frameworkProvider.get(FeatureFlagService);
  return featureFlagService.flags.enable_ai.$;
}
