import { css } from 'lit';

export const embedNoteContentStyles = css`
  .polymind-embed-doc-content-note-blocks polymind-divider,
  .polymind-embed-doc-content-note-blocks polymind-divider > * {
    margin-top: 0px !important;
    margin-bottom: 0px !important;
    padding-top: 8px;
    padding-bottom: 8px;
  }
  .polymind-embed-doc-content-note-blocks polymind-paragraph,
  .polymind-embed-doc-content-note-blocks polymind-list {
    margin-top: 4px !important;
    margin-bottom: 4px !important;
    padding: 0 2px;
  }
  .polymind-embed-doc-content-note-blocks polymind-paragraph *,
  .polymind-embed-doc-content-note-blocks polymind-list * {
    margin-top: 0px !important;
    margin-bottom: 0px !important;
    padding-top: 0;
    padding-bottom: 0;
    line-height: 20px;
    font-size: var(--polymind-font-xs);
    font-weight: 400;
  }
  .polymind-embed-doc-content-note-blocks polymind-list .polymind-list-block__prefix {
    height: 20px;
  }
  .polymind-embed-doc-content-note-blocks polymind-paragraph .quote {
    padding-left: 15px;
    padding-top: 8px;
    padding-bottom: 8px;
  }
  .polymind-embed-doc-content-note-blocks polymind-paragraph:has(.h1),
  .polymind-embed-doc-content-note-blocks polymind-paragraph:has(.h2),
  .polymind-embed-doc-content-note-blocks polymind-paragraph:has(.h3),
  .polymind-embed-doc-content-note-blocks polymind-paragraph:has(.h4),
  .polymind-embed-doc-content-note-blocks polymind-paragraph:has(.h5),
  .polymind-embed-doc-content-note-blocks polymind-paragraph:has(.h6) {
    margin-top: 6px !important;
    margin-bottom: 4px !important;
    padding: 0 2px;
  }
  .polymind-embed-doc-content-note-blocks polymind-paragraph:has(.h1) *,
  .polymind-embed-doc-content-note-blocks polymind-paragraph:has(.h2) *,
  .polymind-embed-doc-content-note-blocks polymind-paragraph:has(.h3) *,
  .polymind-embed-doc-content-note-blocks polymind-paragraph:has(.h4) *,
  .polymind-embed-doc-content-note-blocks polymind-paragraph:has(.h5) *,
  .polymind-embed-doc-content-note-blocks polymind-paragraph:has(.h6) * {
    margin-top: 0px !important;
    margin-bottom: 0px !important;
    padding-top: 0;
    padding-bottom: 0;
    line-height: 20px;
    font-size: var(--polymind-font-xs);
    font-weight: 600;
  }

  .polymind-embed-doc-content-note-blocks inline-comment {
    background-color: unset !important;
    border-bottom: unset !important;
  }

  .polymind-embed-linked-doc-block.horizontal {
    polymind-paragraph,
    polymind-list {
      margin-top: 0 !important;
      margin-bottom: 0 !important;
      max-height: 40px;
      overflow: hidden;
      display: flex;
    }
    polymind-paragraph .quote {
      padding-top: 4px;
      padding-bottom: 4px;
      height: 28px;
    }
    polymind-paragraph .quote::after {
      height: 20px;
      margin-top: 4px !important;
      margin-bottom: 4px !important;
    }
  }
`;
