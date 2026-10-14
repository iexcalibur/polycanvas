import { POLYMIND_DOC_REMOTE_SELECTION_WIDGET } from './doc';
import { PolymindDocRemoteSelectionWidget } from './doc/doc-remote-selection';
import {
  POLYMIND_EDGELESS_REMOTE_SELECTION_WIDGET,
  EdgelessRemoteSelectionWidget,
} from './edgeless';

export function effects() {
  customElements.define(
    POLYMIND_DOC_REMOTE_SELECTION_WIDGET,
    PolymindDocRemoteSelectionWidget
  );
  customElements.define(
    POLYMIND_EDGELESS_REMOTE_SELECTION_WIDGET,
    EdgelessRemoteSelectionWidget
  );
}
