import { Entity, LiveData } from '@toeverything/infra';

import type { WorkspaceService } from '../../workspace';
import type { WorkspacePermissionStore } from '../stores/permission';

/**
 * Single-user local-first: the user always has full access.
 * No roles, no permission checks.
 */
export class WorkspacePermission extends Entity {
  isOwner$ = new LiveData(true);
  isAdmin$ = new LiveData(true);
  isOwnerOrAdmin$ = new LiveData(true);
  isTeam$ = new LiveData(false);
  isRevalidating$ = new LiveData(false);

  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly store: WorkspacePermissionStore
  ) {
    super();
  }

  revalidate = () => {
    this.store.setWorkspacePermissionCache({
      isOwner: true,
      isAdmin: true,
      isTeam: false,
    });
  };

  async waitForRevalidation(_signal?: AbortSignal) {
  }

  override dispose(): void {
  }
}
