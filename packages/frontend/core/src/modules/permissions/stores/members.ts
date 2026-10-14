import type { Permission, WorkspaceInviteLinkExpireTime } from '@polycanvas/graphql';
import { Store } from '@toeverything/infra';

export class WorkspaceMembersStore extends Store {
  constructor() {
    super();
  }

  async fetchMembers(
    _workspaceId: string,
    _skip: number,
    _take: number,
    _signal?: AbortSignal
  ) {
    return { memberCount: 0, members: [] };
  }

  async inviteBatch(_workspaceId: string, _emails: string[]) {
    return [];
  }

  async generateInviteLink(
    _workspaceId: string,
    _expireTime: WorkspaceInviteLinkExpireTime
  ) {
    return undefined;
  }

  async revokeInviteLink(_workspaceId: string, _signal?: AbortSignal) {
    return false;
  }

  async revokeMemberPermission(
    _workspaceId: string,
    _userId: string,
    _signal?: AbortSignal
  ) {
    return false;
  }

  async approveMember(_workspaceId: string, _userId: string) {
    return false;
  }

  async adjustMemberPermission(
    _workspaceId: string,
    _userId: string,
    _permission: Permission
  ) {
    return false;
  }
}
