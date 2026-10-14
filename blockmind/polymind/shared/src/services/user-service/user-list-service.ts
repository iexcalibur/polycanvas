import { createIdentifier } from '@blockmind/global/di';
import type { ExtensionType } from '@blockmind/store';
import type { ReadonlySignal } from '@preact/signals-core';

import type { PolymindUserInfo } from './types';

export interface UserListService {
  users$: ReadonlySignal<PolymindUserInfo[]>;
  isLoading$: ReadonlySignal<boolean>;
  searchText$: ReadonlySignal<string>;
  hasMore$: ReadonlySignal<boolean>;
  loadMore(): void;
  search(keyword: string): void;
}

export const UserListProvider = createIdentifier<UserListService>(
  'polymind-user-list-service'
);

export function UserListServiceExtension(
  service: UserListService
): ExtensionType {
  return {
    setup(di) {
      di.addImpl(UserListProvider, () => service);
    },
  };
}
