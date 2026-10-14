import {
  IndexedDBDocStorage,
  IndexedDBDocSyncStorage,
} from '@polycanvas/nbstore/idb';
import { SqliteDocStorage, SqliteDocSyncStorage } from '@polycanvas/nbstore/sqlite';
import type { StoreClient } from '@polycanvas/nbstore/worker/client';
import { Entity } from '@toeverything/infra';

import type { NbstoreService } from '../../storage';

export class UserDBEngine extends Entity<{
  userId: string;
}> {
  private readonly userId = this.props.userId;
  readonly client: StoreClient;

  DocStorageType =
    BUILD_CONFIG.isElectron || BUILD_CONFIG.isIOS || BUILD_CONFIG.isAndroid
      ? SqliteDocStorage
      : IndexedDBDocStorage;
  DocSyncStorageType =
    BUILD_CONFIG.isElectron || BUILD_CONFIG.isIOS || BUILD_CONFIG.isAndroid
      ? SqliteDocSyncStorage
      : IndexedDBDocSyncStorage;

  canGracefulStop() {
    // TODO(@eyhn): Implement this
    return true;
  }

  constructor(private readonly nbstoreService: NbstoreService) {
    super();

    const { store, dispose } = this.nbstoreService.openStore(
      `userspace:local,${this.userId}`,
      {
        local: {
          doc: {
            name: this.DocStorageType.identifier,
            opts: {
              type: 'userspace',
              flavour: 'local',
              id: this.userId,
            },
          },
          docSync: {
            name: this.DocSyncStorageType.identifier,
            opts: {
              type: 'userspace',
              flavour: 'local',
              id: this.userId,
            },
          },
        },
      }
    );
    this.client = store;
    this.client.docFrontend.start();
    this.disposables.push(() => dispose());
  }
}
