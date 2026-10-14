import { QuickToolExtension } from '@blockmind/polymind-widget-edgeless-toolbar';
import { html } from 'lit';

export const connectorQuickTool = QuickToolExtension(
  'connector',
  ({ block }) => {
    return {
      type: 'connector',
      content: html`<edgeless-connector-tool-button
        .edgeless=${block}
      ></edgeless-connector-tool-button>`,
      priority: 80,
    };
  }
);
