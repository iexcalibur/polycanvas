import { CodeBlockComponent } from './code-block';
import {
  POLYMIND_CODE_TOOLBAR_WIDGET,
  PolymindCodeToolbarWidget,
} from './code-toolbar';
import { PolymindCodeToolbar } from './code-toolbar/components/code-toolbar';
import { LanguageListButton } from './code-toolbar/components/lang-button';
import { PreviewButton } from './code-toolbar/components/preview-button';
import { PolymindCodeUnit } from './highlight/polymind-code-unit';

export function effects() {
  customElements.define('language-list-button', LanguageListButton);
  customElements.define('polymind-code-toolbar', PolymindCodeToolbar);
  customElements.define(POLYMIND_CODE_TOOLBAR_WIDGET, PolymindCodeToolbarWidget);
  customElements.define('polymind-code-unit', PolymindCodeUnit);
  customElements.define('polymind-code', CodeBlockComponent);
  customElements.define('preview-button', PreviewButton);
}

declare global {
  interface HTMLElementTagNameMap {
    'language-list-button': LanguageListButton;
    'polymind-code-toolbar':  PolymindCodeToolbar;
    'preview-button': PreviewButton;
    [POLYMIND_CODE_TOOLBAR_WIDGET]: PolymindCodeToolbarWidget;
  }
}
