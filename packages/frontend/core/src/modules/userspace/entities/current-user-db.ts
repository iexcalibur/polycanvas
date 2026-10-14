import { Entity, LiveData } from '@toeverything/infra';

import type { UserspaceService } from '../services/userspace';
import type { UserDBWithTables } from './user-db';

export class CurrentUserDB extends Entity {
  constructor(private readonly userDBService: UserspaceService) {
    super();
  }

  db$ = new LiveData<UserDBWithTables | null>(null);
}
