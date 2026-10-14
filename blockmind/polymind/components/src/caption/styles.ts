import { css } from 'lit';

export const styles = css`
  .polymind-block-component.border.light .selected-style {
    border-radius: 8px;
    box-shadow: 0px 0px 0px 1px var(--polymind-brand-color);
  }
  .polymind-block-component.border.dark .selected-style {
    border-radius: 8px;
    box-shadow: 0px 0px 0px 1px var(--polymind-brand-color);
  }
  @media print {
    .polymind-block-component.border.light .selected-style,
    .polymind-block-component.border.dark .selected-style {
      box-shadow: none;
    }
  }
`;
