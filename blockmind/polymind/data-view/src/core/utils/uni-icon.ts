import * as icons from '@blocksuite/icons/lit';
import { ShadowlessElement } from '@blockmind/std';
import { css, html, type TemplateResult } from 'lit';
import { property } from 'lit/decorators.js';

import { uniMap } from './uni-component/operation.js';
import { createUniComponentFromWebComponent } from './uni-component/uni-component.js';

export class PolymindLitIcon extends ShadowlessElement {
  static override styles = css`
    polymind-lit-icon {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    polymind-lit-icon svg {
      fill: var(--polymind-icon-color);
    }
  `;

  protected override render(): unknown {
    const createIcon = icons[this.name] as () => TemplateResult;
    return html`${createIcon?.()}`;
  }

  @property({ attribute: false })
  accessor name!: keyof typeof icons;
}

const litIcon = createUniComponentFromWebComponent<{ name: string }>(
  PolymindLitIcon
);
export const createIcon = (name: keyof typeof icons) => {
  return uniMap(litIcon, () => ({ name }));
};
