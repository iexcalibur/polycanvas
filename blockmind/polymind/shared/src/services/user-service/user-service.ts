import { createIdentifier } from '@blockmind/global/di';
import type { ExtensionType } from '@blockmind/store';
import type { Signal } from '@preact/signals-core';

import type { PolymindUserInfo } from './types';

export interface UserService {
  currentUserInfo$: Signal<PolymindUserInfo | null>;
  userInfo$(id: string): Signal<PolymindUserInfo | null>;
  isLoading$(id: string): Signal<boolean>;
  error$(id: string): Signal<string | null>; // user friendly error string
  revalidateUserInfo(id: string): void;
}

export const UserProvider = createIdentifier<UserService>(
  'polymind-user-service'
);

export function UserServiceExtension(service: UserService): ExtensionType {
  return {
    setup(di) {
      di.addImpl(UserProvider, () => service);
    },
  };
}
