import { POLYMIND_OUTLINE_NOTICE, OutlineNotice } from './body/outline-notice';
import {
  POLYMIND_OUTLINE_PANEL_BODY,
  OutlinePanelBody,
} from './body/outline-panel-body';
import { POLYMIND_OUTLINE_NOTE_CARD, OutlineNoteCard } from './card/outline-card';
import {
  POLYMIND_OUTLINE_BLOCK_PREVIEW,
  OutlineBlockPreview,
} from './card/outline-preview';
import {
  POLYMIND_OUTLINE_PANEL_HEADER,
  OutlinePanelHeader,
} from './header/outline-panel-header';
import {
  POLYMIND_OUTLINE_NOTE_PREVIEW_SETTING_MENU,
  OutlineNotePreviewSettingMenu,
} from './header/outline-setting-menu';
import {
  POLYMIND_MOBILE_OUTLINE_MENU,
  MobileOutlineMenu,
} from './mobile-outline-panel';
import { POLYMIND_OUTLINE_PANEL, OutlinePanel } from './outline-panel';
import { POLYMIND_OUTLINE_VIEWER, OutlineViewer } from './outline-viewer';

export function effects() {
  customElements.define(
    POLYMIND_OUTLINE_NOTE_PREVIEW_SETTING_MENU,
    OutlineNotePreviewSettingMenu
  );
  customElements.define(POLYMIND_OUTLINE_NOTICE, OutlineNotice);
  customElements.define(POLYMIND_OUTLINE_PANEL, OutlinePanel);
  customElements.define(POLYMIND_OUTLINE_PANEL_HEADER, OutlinePanelHeader);
  customElements.define(POLYMIND_OUTLINE_NOTE_CARD, OutlineNoteCard);
  customElements.define(POLYMIND_OUTLINE_VIEWER, OutlineViewer);
  customElements.define(POLYMIND_MOBILE_OUTLINE_MENU, MobileOutlineMenu);
  customElements.define(POLYMIND_OUTLINE_BLOCK_PREVIEW, OutlineBlockPreview);
  customElements.define(POLYMIND_OUTLINE_PANEL_BODY, OutlinePanelBody);
}
