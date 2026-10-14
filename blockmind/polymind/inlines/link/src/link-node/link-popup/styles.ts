import { fontSMStyle, panelBaseStyle } from '@blockmind/polymind-shared/styles';
import { css } from 'lit';

const editLinkStyle = css`
  .polymind-link-edit-popover {
    display: grid;
    grid-template-columns: auto auto;
    grid-template-rows: repeat(2, 1fr);
    grid-template-areas:
      'text-area .'
      'link-area btn';
    justify-items: center;
    align-items: center;
    width: 320px;
    gap: 8px 12px;
    padding: 8px;
    box-sizing: content-box;
  }

  ${fontSMStyle('.polymind-link-edit-popover label')}
  .polymind-link-edit-popover label {
    box-sizing: border-box;
    color: var(--polymind-icon-color);
    font-weight: 400;
  }

  ${fontSMStyle('.polymind-link-edit-popover input')}
  .polymind-link-edit-popover input {
    color: inherit;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--polymind-text-primary-color);
  }
  .polymind-link-edit-popover input::placeholder {
    color: var(--polymind-placeholder-color);
  }
  input:focus {
    outline: none;
  }
  .polymind-link-edit-popover input:focus ~ label,
  .polymind-link-edit-popover input:active ~ label {
    color: var(--polymind-primary-color);
  }

  .polymind-edit-area {
    width: 280px;
    padding: 4px 10px;
    display: grid;
    gap: 8px;
    grid-template-columns: 26px auto;
    grid-template-rows: repeat(1, 1fr);
    grid-template-areas: 'label input';
    user-select: none;
    box-sizing: border-box;

    border: 1px solid var(--polymind-border-color);
    box-sizing: border-box;

    outline: none;
    border-radius: 4px;
    background: transparent;
  }
  .polymind-edit-area:focus-within {
    border-color: var(--polymind-blue-700);
    box-shadow: var(--polymind-active-shadow);
  }

  .polymind-edit-area.text {
    grid-area: text-area;
  }

  .polymind-edit-area.link {
    grid-area: link-area;
  }

  .polymind-edit-label {
    grid-area: label;
  }

  .polymind-edit-input {
    grid-area: input;
  }

  .polymind-confirm-button {
    grid-area: btn;
    user-select: none;
  }
`;

export const linkPopupStyle = css`
  :host {
    box-sizing: border-box;
  }

  .mock-selection {
    position: absolute;
    background-color: rgba(35, 131, 226, 0.28);
  }

  ${panelBaseStyle('.popover-container')}
  .popover-container {
    z-index: var(--polymind-z-index-popover);
    animation: polymind-popover-fade-in 0.2s ease;
    position: absolute;
  }

  @keyframes polymind-popover-fade-in {
    from {
      opacity: 0;
      transform: translateY(-3px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .overlay-root {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    z-index: var(--polymind-z-index-popover);
  }

  .mock-selection-container {
    pointer-events: none;
  }

  .polymind-link-popover.create {
    display: flex;
    gap: 12px;
    padding: 8px;

    color: var(--polymind-text-primary-color);
  }

  .polymind-link-popover-input {
    min-width: 280px;
    height: 30px;
    box-sizing: border-box;
    padding: 4px 10px;
    background: var(--polymind-white-10);
    border-radius: 4px;
    border-width: 1px;
    border-style: solid;
    border-color: var(--polymind-border-color);
    color: var(--polymind-text-primary-color);
  }
  ${fontSMStyle('.polymind-link-popover-input')}
  .polymind-link-popover-input::placeholder {
    color: var(--polymind-placeholder-color);
  }
  .polymind-link-popover-input:focus {
    border-color: var(--polymind-blue-700);
    box-shadow: var(--polymind-active-shadow);
  }

  ${editLinkStyle}
`;
