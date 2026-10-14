import { Store } from '@toeverything/infra';

export class MemberSearchStore extends Store {
  constructor() {
    super();
  }

  async getMembersByEmailOrName(
    _workspaceId: string,
    _query?: string,
    _skip?: number,
    _take?: number,
    _signal?: AbortSignal
  ) {
    return { memberCount: 0, members: [] };
  }
}
