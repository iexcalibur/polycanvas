import { Service } from '@toeverything/infra';
import { type Observable, of } from 'rxjs';

import type { FilterProvider } from '../../provider';
import type { FilterParams } from '../../types';

export class SharedFilterProvider extends Service implements FilterProvider {
  constructor() {
    super();
  }

  filter$(_params: FilterParams): Observable<Set<string>> {
    return of(new Set<string>());
  }
}
