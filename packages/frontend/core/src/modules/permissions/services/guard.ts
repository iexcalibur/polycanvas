import { LiveData, Service } from '@toeverything/infra';

import type { WorkspaceService } from '../../workspace';
import type {
  DocPermissionActions,
  GuardStore,
  WorkspacePermissionActions,
} from '../stores/guard';
import type { WorkspacePermissionService } from './permission';

/**
 * Single-user local-first: every action is always permitted.
 */
export class GuardService extends Service {
  constructor(
    private readonly guardStore: GuardStore,
    private readonly workspaceService: WorkspaceService,
    private readonly workspacePermissionService: WorkspacePermissionService
  ) {
    super();
  }

  can$<T extends WorkspacePermissionActions | DocPermissionActions>(
    _action: T,
    ..._args: T extends DocPermissionActions ? [string] : []
  ): LiveData<boolean | undefined> {
    return new LiveData<boolean | undefined>(true);
  }

  async can<T extends WorkspacePermissionActions | DocPermissionActions>(
    _action: T,
    ..._args: T extends DocPermissionActions ? [string] : []
  ): Promise<boolean> {
    return true;
  }

  revalidateCan<T extends WorkspacePermissionActions | DocPermissionActions>(
    _action: T,
    ..._args: T extends DocPermissionActions ? [string] : []
  ) {
  }

  override dispose() {
  }
}
