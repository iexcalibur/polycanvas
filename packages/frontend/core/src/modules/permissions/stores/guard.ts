import {
  type GetDocRolePermissionsQuery,
  type GetWorkspaceInfoQuery,
} from '@polycanvas/graphql';
import { Store } from '@toeverything/infra';

import type { WorkspaceService } from '../../workspace';

export type WorkspacePermissionActions = keyof Omit<
  GetWorkspaceInfoQuery['workspace']['permissions'],
  '__typename'
>;

export type DocPermissionActions = keyof Omit<
  GetDocRolePermissionsQuery['workspace']['doc']['permissions'],
  '__typename'
>;

/**
 * Single-user local-first: no permission fetching needed.
 */
export class GuardStore extends Store {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  async getWorkspacePermissions(): Promise<
    Record<WorkspacePermissionActions, boolean>
  > {
    return {} as Record<WorkspacePermissionActions, boolean>;
  }

  async getDocPermissions(
    _docId: string
  ): Promise<Record<DocPermissionActions, boolean>> {
    return {} as Record<DocPermissionActions, boolean>;
  }
}
