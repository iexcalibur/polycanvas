import { SignalWatcher, WithDisposable } from '@blockmind/global/lit';
import { ShadowlessElement } from '@blockmind/std';
import { consume } from '@lit/context';
import { html } from 'lit';

import { type TocContext, tocContext } from '../config';
import * as styles from './outline-setting-menu.css';

export const POLYMIND_OUTLINE_NOTE_PREVIEW_SETTING_MENU =
  'polymind-outline-note-preview-setting-menu';

export class OutlineNotePreviewSettingMenu extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  override render() {
    const showPreviewIcon = this._context.showIcons$.value;

    return html`<div
      class=${styles.notePreviewSettingMenuContainer}
      @click=${(e: MouseEvent) => e.stopPropagation()}
    >
      <div class=${styles.notePreviewSettingMenuItem}>
        <div class=${styles.settingLabel}>Settings</div>
      </div>
      <div class="${styles.notePreviewSettingMenuItem} ${styles.action}">
        <div class=${styles.actionLabel}>Show type icon</div>
        <div class=${styles.toggleButton}>
          <toggle-switch
            .on=${showPreviewIcon}
            .onChange=${() => {
              this._context.showIcons$.value = !showPreviewIcon;
            }}
          ></toggle-switch>
        </div>
      </div>
    </div>`;
  }

  @consume({ context: tocContext })
  private accessor _context!: TocContext;
}

declare global {
  interface HTMLElementTagNameMap {
    [POLYMIND_OUTLINE_NOTE_PREVIEW_SETTING_MENU]: OutlineNotePreviewSettingMenu;
  }
}
