import { unsafeCSSVarV2 } from '@blockmind/polymind-shared/theme';
import { WithDisposable } from '@blockmind/global/lit';
import { ShadowlessElement } from '@blockmind/std';
import { css } from 'lit';
import { property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { html } from 'lit/static-html.js';

import type { SelectTag } from '../../logical/index.js';
import { getColorByColor } from './colors.js';

export class MultiTagView extends WithDisposable(ShadowlessElement) {
  static override styles = css`
    polymind-multi-tag-view {
      display: flex;
      align-items: center;
      width: 100%;
      height: 100%;
      min-height: 22px;
    }

    .polymind-select-cell-container * {
      box-sizing: border-box;
    }

    .polymind-select-cell-container {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 6px;
      width: 100%;
      font-size: var(--polymind-font-sm);
    }

    .polymind-select-cell-container .select-selected {
      height: 22px;
      font-size: 14px;
      line-height: 20px;
      padding: 0 8px;
      border-radius: 4px;
      white-space: nowrap;
      background: var(--polymind-tag-white);
      overflow: hidden;
      text-overflow: ellipsis;
      border: 1px solid ${unsafeCSSVarV2('database/border')};
    }
  `;

  override render() {
    const values = this.value;
    const map = new Map<string, SelectTag>(this.options?.map(v => [v.id, v]));
    return html`
      <div contenteditable="false" class="polymind-select-cell-container">
        ${repeat(values, id => {
          const option = map.get(id);
          if (!option) {
            return;
          }
          const style = styleMap({
            backgroundColor: getColorByColor(option.color),
          });
          return html`<span
            data-testid="tag-selected"
            class="select-selected"
            style=${style}
            >${option.value}</span
          >`;
        })}
      </div>
    `;
  }

  @property({ attribute: false })
  accessor options: SelectTag[] = [];

  @query('.polymind-select-cell-container')
  accessor selectContainer!: HTMLElement;

  @property({ attribute: false })
  accessor value: string[] = [];
}

declare global {
  interface HTMLElementTagNameMap {
    'polymind-multi-tag-view': MultiTagView;
  }
}
