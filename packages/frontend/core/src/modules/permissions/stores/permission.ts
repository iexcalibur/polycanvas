import { Store } from '@toeverything/infra';

import type { WorkspaceLocalState } from '../../workspace';

export class WorkspacePermissionStore extends Store {
  constructor(private readonly workspaceLocalState: WorkspaceLocalState) {
    super();
  }

  async fetchWorkspaceInfo(_workspaceId: string, _signal?: AbortSignal) {
    // Single-user: always return full access
    return {
      workspace: {
        role: 99, // Owner
        team: false,
      },
    } as any;
  }

  async leaveWorkspace(_workspaceId: string) {
  }

  watchWorkspacePermissionCache() {
    return this.workspaceLocalState.watch<{
      isOwner: boolean;
      isAdmin: boolean;
      isTeam: boolean;
    }>('permission');
  }

  setWorkspacePermissionCache(permission: {
    isOwner: boolean;
    isAdmin: boolean;
    isTeam: boolean;
  }) {
    this.workspaceLocalState.set('permission', permission);
  }
}
