import type {
  DocRole,
  GrantDocUserRolesInput,
  PaginationInput,
  UpdateDocDefaultRoleInput,
} from '@polycanvas/graphql';
import { Store } from '@toeverything/infra';

export class DocGrantedUsersStore extends Store {
  constructor() {
    super();
  }

  async fetchDocGrantedUsersList(
    _workspaceId: string,
    _docId: string,
    _pagination: PaginationInput,
    _signal?: AbortSignal
  ) {
    return { users: [], totalCount: 0 };
  }

  async grantDocUserRoles(_input: GrantDocUserRolesInput) {
    return false;
  }

  async revokeDocUserRoles(
    _workspaceId: string,
    _docId: string,
    _userId: string
  ) {
    return false;
  }

  async updateDocUserRole(
    _workspaceId: string,
    _docId: string,
    _userId: string,
    _role: DocRole
  ) {
    return false;
  }

  async updateDocDefaultRole(_input: UpdateDocDefaultRoleInput) {
    return false;
  }
}
