import type { ResolvedStateInfo } from '@blockmind/polymind-components/resource';
import { unsafeCSSVarV2 } from '@blockmind/polymind-shared/theme';
import { WithDisposable } from '@blockmind/global/lit';
import { ShadowlessElement } from '@blockmind/std';
import { css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

export const SURFACE_IMAGE_CARD_WIDTH = 220;
export const SURFACE_IMAGE_CARD_HEIGHT = 122;
export const NOTE_IMAGE_CARD_WIDTH = 752;
export const NOTE_IMAGE_CARD_HEIGHT = 78;

export class ImageBlockFallbackCard extends WithDisposable(ShadowlessElement) {
  static override styles = css`
    polymind-image-fallback-card {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      user-select: none;
    }

    .polymind-image-fallback-card {
      display: flex;
      flex: 1;
      gap: 8px;
      align-self: stretch;
      flex-direction: column;
      justify-content: space-between;
      border-radius: 8px;
      border: 1px solid ${unsafeCSSVarV2('layer/background/tertiary')};
      background: ${unsafeCSSVarV2('layer/background/secondary')};
      padding: 12px;
    }

    .truncate {
      align-self: stretch;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    }

    .polymind-image-fallback-card-title {
      display: flex;
      flex-direction: row;
      gap: 8px;
      align-items: center;
      align-self: stretch;
    }

    .polymind-image-fallback-card-title-icon {
      display: flex;
      width: 16px;
      height: 16px;
      align-items: center;
      justify-content: center;
      color: var(--polymind-text-primary-color);
    }

    .polymind-image-fallback-card-title-text {
      color: var(--polymind-placeholder-color);
      font-family: var(--polymind-font-family);
      font-size: var(--polymind-font-sm);
      font-style: normal;
      font-weight: 600;
      line-height: 22px;
    }

    .polymind-image-fallback-card-description {
      color: var(--polymind-text-secondary-color);
      font-family: var(--polymind-font-family);
      font-size: var(--polymind-font-xs);
      font-style: normal;
      font-weight: 400;
      line-height: 20px;
    }

    .polymind-image-fallback-card.loading {
      .polymind-image-fallback-card-title {
        color: var(--polymind-placeholder-color);
      }
    }

    .polymind-image-fallback-card.error {
      .polymind-image-fallback-card-title-icon {
        color: ${unsafeCSSVarV2('status/error')};
      }
    }
  `;

  override render() {
    const { icon, title, description, loading, error } = this.state;

    const classInfo = {
      'polymind-image-fallback-card': true,
      'drag-target': true,
      loading,
      error,
    };

    return html`
      <div class=${classMap(classInfo)}>
        <div class="polymind-image-fallback-card-title">
          <div class="polymind-image-fallback-card-title-icon">${icon}</div>
          <div class="polymind-image-fallback-card-title-text truncate">
            ${title}
          </div>
        </div>
        <div class="polymind-image-fallback-card-description truncate">
          ${description}
        </div>
      </div>
    `;
  }

  @property({ attribute: false })
  accessor state!: ResolvedStateInfo;
}

declare global {
  interface HTMLElementTagNameMap {
    'polymind-image-fallback-card': ImageBlockFallbackCard;
  }
}
