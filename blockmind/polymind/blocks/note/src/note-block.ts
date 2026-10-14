import type { NoteBlockModel } from '@blockmind/polymind-model';
import { BlockComponent } from '@blockmind/std';
import { css, html } from 'lit';

export class NoteBlockComponent extends BlockComponent<NoteBlockModel> {
  static override styles = css`
    .polymind-note-block-container {
      display: flow-root;
    }
    .polymind-note-block-container.selected {
      background-color: var(--polymind-hover-color);
    }
  `;

  override connectedCallback() {
    super.connectedCallback();
  }

  override renderBlock() {
    return html`
      <div class="polymind-note-block-container">
        <div class="polymind-block-children-container">
          ${this.renderChildren(this.model)}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'polymind-note': NoteBlockComponent;
  }
}
