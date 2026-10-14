import { fontXSStyle, panelBaseStyle } from '@blockmind/polymind-shared/styles';
import { css } from 'lit';

export const renameStyles = css`
  ${panelBaseStyle('.polymind-attachment-rename-container')}
  .polymind-attachment-rename-container {
    position: relative;
    display: flex;
    align-items: center;
    width: 320px;
    gap: 12px;
    padding: 12px;
    z-index: var(--polymind-z-index-popover);
  }

  .polymind-attachment-rename-input-wrapper {
    display: flex;
    min-width: 280px;
    height: 30px;
    box-sizing: border-box;
    padding: 4px 10px;
    background: var(--polymind-white-10);
    border-radius: 4px;
    border: 1px solid var(--polymind-border-color);
  }

  .polymind-attachment-rename-input-wrapper:focus-within {
    border-color: var(--polymind-blue-700);
    box-shadow: var(--polymind-active-shadow);
  }

  .polymind-attachment-rename-input-wrapper input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    color: var(--polymind-text-primary-color);
  }
  ${fontXSStyle('.polymind-attachment-rename-input-wrapper input')}

  .polymind-attachment-rename-input-wrapper input::placeholder {
    color: var(--polymind-placeholder-color);
  }

  .polymind-attachment-rename-extension {
    font-size: var(--polymind-font-xs);
    color: var(--polymind-text-secondary-color);
  }

  .polymind-attachment-rename-overlay-mask {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: var(--polymind-z-index-popover);
  }
`;

export const styles = css`
  :host {
    z-index: 1;
  }
`;
