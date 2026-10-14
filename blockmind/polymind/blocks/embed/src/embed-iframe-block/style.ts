import { css } from 'lit';

export const embedIframeBlockStyles = css`
  .polymind-embed-iframe-block-container {
    display: flex;
    width: 100%;
    border-radius: 8px;
    user-select: none;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .polymind-embed-iframe-block-container.in-surface {
    height: 100%;
  }

  .polymind-embed-iframe-block-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: none;
  }

  .polymind-embed-iframe-source {
    position: absolute;
    left: 8px;
    bottom: 8px;
    padding: 2px 6px;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    border-radius: 4px;
    font-size: 12px;
    line-height: 16px;
    pointer-events: none;
  }
  .polymind-embed-iframe-block-overlay.show {
    display: block;
  }
`;
