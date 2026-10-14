import { unsafeCSSVar, unsafeCSSVarV2 } from '@blockmind/polymind-shared/theme';
import { baseTheme } from '@polycanvas/theme';
import { css, unsafeCSS } from 'lit';

export const styles = css`
  bookmark-card {
    display: block;
    height: 100%;
    width: 100%;
  }

  .polymind-bookmark-card {
    container: polymind-bookmark-card / inline-size;
    margin: 0 auto;
    box-sizing: border-box;
    display: flex;
    width: 100%;

    border-radius: 8px;
    border: 1px solid ${unsafeCSSVarV2('layer/background/tertiary')};

    background: ${unsafeCSSVarV2('layer/background/primary')};
    user-select: none;
  }

  .polymind-bookmark-content {
    width: calc(100% - 204px);
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    align-self: stretch;
    gap: 4px;
    padding: 12px;
  }

  .polymind-bookmark-content-title {
    display: flex;
    flex-direction: row;
    gap: 8px;
    align-items: center;

    align-self: stretch;
  }

  .polymind-bookmark-content-title-icon {
    display: flex;
    width: 16px;
    height: 16px;
    justify-content: center;
    align-items: center;
  }

  .polymind-bookmark-content-title-icon img,
  .polymind-bookmark-content-title-icon object,
  .polymind-bookmark-content-title-icon svg {
    width: 16px;
    height: 16px;
    fill: var(--polymind-background-primary-color);
  }

  .polymind-bookmark-content-title-text {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;

    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--polymind-text-primary-color);

    font-family: var(--polymind-font-family);
    font-size: var(--polymind-font-sm);
    font-style: normal;
    font-weight: 600;
    line-height: 22px;
  }

  .polymind-bookmark-content-description {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;

    flex-grow: 1;

    white-space: normal;
    word-break: break-word;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--polymind-text-primary-color);

    font-family: var(--polymind-font-family);
    font-size: var(--polymind-font-xs);
    font-style: normal;
    font-weight: 400;
    line-height: 20px;
  }

  .polymind-bookmark-content-url {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    width: max-content;
    max-width: 100%;
  }

  .polymind-bookmark-content-url > span {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;

    word-break: break-all;
    white-space: normal;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--polymind-text-secondary-color);

    font-family: ${unsafeCSS(baseTheme.fontSansFamily)};
    font-size: var(--polymind-font-xs);
    font-style: normal;
    font-weight: 400;
    line-height: 20px;
  }
  .polymind-bookmark-content-url:hover > span {
    color: var(--polymind-link-color);
  }
  .polymind-bookmark-content-url:hover {
    fill: var(--polymind-link-color);
  }

  .polymind-bookmark-content-url-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 12px;
    height: 20px;
  }
  .polymind-bookmark-content-url-icon {
    height: 12px;
    width: 12px;
    color: ${unsafeCSSVar('iconSecondary')};
  }

  .polymind-bookmark-banner {
    margin: 12px 12px 0px 0px;
    width: 204px;
    max-width: 100%;
    height: 102px;
  }

  .polymind-bookmark-banner img,
  .polymind-bookmark-banner object,
  .polymind-bookmark-banner svg {
    width: 204px;
    max-width: 100%;
    height: 102px;
    object-fit: cover;
    border-radius: 4px;
  }

  .polymind-bookmark-card.comment-highlighted {
    outline: 2px solid ${unsafeCSSVarV2('block/comment/highlightUnderline')};
  }

  .polymind-bookmark-card.loading {
    .polymind-bookmark-content-title-text {
      color: var(--polymind-placeholder-color);
    }
  }

  .polymind-bookmark-card.error {
    .polymind-bookmark-content-description {
      color: var(--polymind-placeholder-color);
    }
  }

  .polymind-bookmark-card.selected {
    .polymind-bookmark-content-url > span {
      color: var(--polymind-link-color);
    }
    .polymind-bookmark-content-url .polymind-bookmark-content-url-icon {
      color: var(--polymind-link-color);
    }
  }

  .polymind-bookmark-card.list {
    .polymind-bookmark-content {
      width: 100%;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }

    .polymind-bookmark-content-title {
      width: calc(100% - 204px);
    }

    .polymind-bookmark-content-url {
      width: 204px;
      justify-content: flex-end;
    }

    .polymind-bookmark-content-description {
      display: none;
    }

    .polymind-bookmark-banner {
      display: none;
    }
  }

  .polymind-bookmark-card.vertical {
    flex-direction: column-reverse;
    height: 100%;

    .polymind-bookmark-content {
      width: 100%;
    }

    .polymind-bookmark-content-description {
      -webkit-line-clamp: 6;
      max-height: 120px;
    }

    .polymind-bookmark-content-url-wrapper {
      max-width: fit-content;
      display: flex;
      align-items: flex-end;
      flex-grow: 1;
      cursor: pointer;
    }

    .polymind-bookmark-banner {
      width: 340px;
      height: 170px;
      margin-left: 12px;
    }

    .polymind-bookmark-banner img,
    .polymind-bookmark-banner object,
    .polymind-bookmark-banner svg {
      width: 340px;
      height: 170px;
    }
  }

  .polymind-bookmark-card.cube {
    .polymind-bookmark-content {
      width: 100%;
      flex-direction: column;
      align-items: flex-start;
      justify-content: space-between;
    }

    .polymind-bookmark-content-title {
      flex-direction: column;
      gap: 4px;
      align-items: flex-start;
    }

    .polymind-bookmark-content-title-text {
      -webkit-line-clamp: 2;
    }

    .polymind-bookmark-content-description {
      display: none;
    }

    .polymind-bookmark-banner {
      display: none;
    }
  }

  @container polymind-bookmark-card (width < 375px) {
    .polymind-bookmark-content {
      width: 100%;
    }
    .polymind-bookmark-card:not(.edgeless) .polymind-bookmark-banner {
      display: none;
    }
  }
`;
