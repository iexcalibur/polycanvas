import { css } from 'lit';

export const listPrefix = css`
  .polymind-list-block__prefix {
    display: flex;
    color: var(--polymind-blue-700);
    font-size: var(--polymind-font-sm);
    user-select: none;
    position: relative;
  }

  .polymind-list-block__numbered {
    min-width: 22px;
    height: 24px;
    margin-left: 2px;
  }

  .polymind-list-block__todo-prefix {
    display: flex;
    align-items: center;
    cursor: pointer;
    width: 24px;
    height: 24px;
    color: var(--polymind-icon-color);
  }

  .polymind-list-block__todo-prefix.readonly {
    cursor: default;
  }

  .polymind-list-block__todo-prefix > svg {
    width: 20px;
    height: 20px;
  }
`;

export const listBlockStyles = css`
  polymind-list {
    display: block;
    font-size: var(--polymind-font-base);
  }

  polymind-list code {
    font-size: calc(var(--polymind-font-base) - 3px);
    padding: 0px 4px 2px;
  }

  .polymind-list-block-container {
    box-sizing: border-box;
    border-radius: 4px;
    position: relative;
  }
  .polymind-list-block-container .polymind-list-block-container {
    margin-top: 0;
  }
  .polymind-list-rich-text-wrapper {
    position: relative;
    display: flex;
  }
  .polymind-list-rich-text-wrapper rich-text {
    flex: 1;
  }

  .polymind-list--checked {
    color: var(--polymind-text-secondary-color);
  }

  ${listPrefix}
`;
