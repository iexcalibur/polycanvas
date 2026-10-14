import { scrollbarStyle } from '@blockmind/polymind-shared/styles';
import { unsafeCSSVarV2 } from '@blockmind/polymind-shared/theme';
import { css } from 'lit';

export const codeBlockStyles = css`
  polymind-code {
    display: block;
  }

  .polymind-code-block-container {
    font-size: var(--polymind-font-xs);
    line-height: var(--polymind-line-height);
    position: relative;
    padding: 32px 20px;
    background: var(--polymind-background-code-block);
    border-radius: 10px;
    box-sizing: border-box;
  }

  .polymind-code-block-container.mobile {
    padding: 12px;
  }

  .polymind-code-block-container.highlight-comment {
    outline: 2px solid ${unsafeCSSVarV2('block/comment/highlightUnderline')};
  }

  ${scrollbarStyle('.polymind-code-block-container rich-text')}

  /* In Chromium 121+, non-auto scrollbar-width/color override ::-webkit-scrollbar styles. */
  @supports not selector(::-webkit-scrollbar) {
    .polymind-code-block-container rich-text {
      scrollbar-width: thin;
      scrollbar-color: ${unsafeCSSVarV2('icon/secondary', '#b1b1b1')}
        transparent;
      scrollbar-gutter: stable both-edges;
    }
  }

  .polymind-code-block-container .inline-editor {
    font-family: var(--polymind-font-code-family);
    font-variant-ligatures: none;
  }

  .polymind-code-block-container v-line {
    position: relative;
    display: inline-grid !important;
    grid-template-columns: auto minmax(0, 1fr);
  }

  .polymind-code-block-container.disable-line-numbers v-line {
    grid-template-columns: unset;
  }

  .polymind-code-block-container div:has(> v-line) {
    display: grid;
  }

  .polymind-code-block-container .line-number {
    position: sticky;
    text-align: left;
    padding-right: 12px;
    width: 32px;
    word-break: break-word;
    white-space: nowrap;
    left: -0.5px;
    z-index: 1;
    background: var(--polymind-background-code-block);
    font-size: var(--polymind-font-xs);
    line-height: var(--polymind-line-height);
    color: var(--polymind-text-secondary);
    box-sizing: border-box;
    user-select: none;
  }

  .polymind-code-block-container.disable-line-numbers .line-number {
    display: none;
  }

  polymind-code .polymind-code-block-preview {
    padding: 12px;
  }
`;
