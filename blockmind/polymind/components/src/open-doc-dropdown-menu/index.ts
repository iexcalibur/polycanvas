import { OpenDocDropdownMenu } from './dropdown-menu';

export * from './dropdown-menu';

export function effects() {
  customElements.define('polymind-open-doc-dropdown-menu', OpenDocDropdownMenu);
}
