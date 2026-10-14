import { UserFriendlyError } from '@polycanvas/error';
import {
  type PolymindUserInfo,
  UserServiceExtension,
} from '@blockmind/polymind/shared/services';

interface AccountInfo {
  id: string;
  label: string;
  avatar?: string | null;
  email?: string | null;
}

interface AuthServiceLike {
  session: {
    account$: { map: (fn: (a: AccountInfo | null) => PolymindUserInfo | null) => { signal: unknown } };
  };
}

interface PublicUserServiceLike {
  publicUser$(id: string): { signal: unknown };
  isLoading$(id: string): { signal: unknown };
  error$(id: string): { selector: (fn: (e: unknown) => string | null) => { signal: unknown } };
  revalidate(id: string): void;
}

export function patchUserExtensions(
  publicUserService: PublicUserServiceLike,
  authService: AuthServiceLike
) {
  return UserServiceExtension({
    // eslint-disable-next-line rxjs/finnish
    currentUserInfo$: authService.session.account$.map(account => {
      if (!account) {
        return null;
      }
      return {
        id: account.id,
        name: account.label,
        avatar: account.avatar,
        removed: false,
      } as PolymindUserInfo;
    }).signal,
    // eslint-disable-next-line rxjs/finnish
    userInfo$(id) {
      return publicUserService.publicUser$(id).signal;
    },
    // eslint-disable-next-line rxjs/finnish
    isLoading$(id) {
      return publicUserService.isLoading$(id).signal;
    },
    // eslint-disable-next-line rxjs/finnish
    error$(id) {
      return publicUserService.error$(id).selector(error => {
        if (error) {
          return UserFriendlyError.fromAny(error).name;
        } else {
          return null;
        }
      }).signal;
    },
    revalidateUserInfo(id) {
      publicUserService.revalidate(id);
    },
  });
}
