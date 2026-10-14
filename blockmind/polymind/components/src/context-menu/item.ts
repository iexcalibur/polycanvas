import { SignalWatcher, WithDisposable } from '@blockmind/global/lit';
import { ShadowlessElement } from '@blockmind/std';
import { property } from 'lit/decorators.js';

import type { Menu } from './menu.js';

export abstract class MenuItem extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  @property({ attribute: false })
  accessor menu!: Menu;
}
