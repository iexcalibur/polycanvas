import { Service } from '@toeverything/infra';
import { map, type Observable } from 'rxjs';

import type { GlobalState } from '../../storage';
import type { EditorSettingProvider } from '../provider/editor-setting-provider';

export class CurrentUserDBEditorSettingProvider
  extends Service
  implements EditorSettingProvider
{
  private readonly fallback: GlobalStateEditorSettingProvider;

  constructor(public readonly globalState: GlobalState) {
    super();
    this.fallback = new GlobalStateEditorSettingProvider(this.globalState);
  }

  set(key: string, value: string): void {
    this.fallback.set(key, value);
  }

  get(key: string): string | undefined {
    return this.fallback.get(key);
  }

  watchAll(): Observable<Record<string, string>> {
    return this.fallback.watchAll();
  }
}

const storageKey = 'editor-setting';

class GlobalStateEditorSettingProvider implements EditorSettingProvider {
  constructor(public readonly globalState: GlobalState) {}
  set(key: string, value: string): void {
    const all = this.globalState.get<Record<string, string>>(storageKey) ?? {};
    const after = {
      ...all,
      [key]: value,
    };
    this.globalState.set(storageKey, after);
  }
  get(key: string): string | undefined {
    return this.globalState.get<Record<string, string>>(storageKey)?.[key];
  }
  watchAll(): Observable<Record<string, string>> {
    return this.globalState
      .watch<Record<string, string>>(storageKey)
      .pipe(map(all => all ?? {}));
  }
}
