import { PolymindLink } from './link-node/polymind-link';
import { LinkPopup } from './link-node/link-popup/link-popup';

export function effects() {
  customElements.define('link-popup', LinkPopup);
  customElements.define('polymind-link', PolymindLink);
}
