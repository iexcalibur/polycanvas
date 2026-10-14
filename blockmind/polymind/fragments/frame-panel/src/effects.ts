import {
  POLYMIND_FRAME_PANEL_BODY,
  FramePanelBody,
} from './body/frame-panel-body';
import { POLYMIND_FRAME_CARD, FrameCard } from './card/frame-card';
import {
  POLYMIND_FRAME_CARD_TITLE,
  FrameCardTitle,
} from './card/frame-card-title';
import {
  POLYMIND_FRAME_TITLE_EDITOR,
  FrameCardTitleEditor,
} from './card/frame-card-title-editor';
import { POLYMIND_FRAME_PREVIEW, FramePreview } from './card/frame-preview';
import { POLYMIND_FRAME_PANEL, FramePanel } from './frame-panel';
import {
  POLYMIND_FRAME_PANEL_HEADER,
  FramePanelHeader,
} from './header/frame-panel-header';
import {
  POLYMIND_FRAMES_SETTING_MENU,
  FramesSettingMenu,
} from './header/frames-setting-menu';

export function effects() {
  customElements.define(POLYMIND_FRAME_PANEL, FramePanel);
  customElements.define(POLYMIND_FRAME_TITLE_EDITOR, FrameCardTitleEditor);
  customElements.define(POLYMIND_FRAME_CARD, FrameCard);
  customElements.define(POLYMIND_FRAME_CARD_TITLE, FrameCardTitle);
  customElements.define(POLYMIND_FRAME_PANEL_BODY, FramePanelBody);
  customElements.define(POLYMIND_FRAME_PANEL_HEADER, FramePanelHeader);
  customElements.define(POLYMIND_FRAMES_SETTING_MENU, FramesSettingMenu);
  customElements.define(POLYMIND_FRAME_PREVIEW, FramePreview);
}
