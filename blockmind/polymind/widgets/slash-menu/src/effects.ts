import { POLYMIND_SLASH_MENU_WIDGET } from './consts';
import { InnerSlashMenu, SlashMenu } from './slash-menu-popover';
import { PolymindSlashMenuWidget } from './widget';

export function effects() {
  customElements.define(POLYMIND_SLASH_MENU_WIDGET, PolymindSlashMenuWidget);
  customElements.define('polymind-slash-menu', SlashMenu);
  customElements.define('inner-slash-menu', InnerSlashMenu);
}

declare global {
  interface HTMLElementTagNameMap {
    [POLYMIND_SLASH_MENU_WIDGET]: PolymindSlashMenuWidget;
  }
}
