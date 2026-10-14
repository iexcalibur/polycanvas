import { DesktopApiService } from '@polycanvas/core/modules/desktop-api';
import {
  CacheStorage,
  GlobalCache,
  GlobalState,
} from '@polycanvas/core/modules/storage';
import {
  ElectronGlobalCache,
  ElectronGlobalState,
} from '@polycanvas/core/modules/storage/impls/electron';
import { IDBGlobalState } from '@polycanvas/core/modules/storage/impls/storage';
import type { Framework } from '@toeverything/infra';

export function configureElectronStateStorageImpls(framework: Framework) {
  framework.impl(GlobalCache, ElectronGlobalCache, [DesktopApiService]);
  framework.impl(GlobalState, ElectronGlobalState, [DesktopApiService]);
  framework.impl(CacheStorage, IDBGlobalState);
}
