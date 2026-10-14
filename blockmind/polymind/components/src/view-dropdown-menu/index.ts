import { ViewDropdownMenu } from './dropdown-menu';

export * from './dropdown-menu';

export function effects() {
  customElements.define('polymind-view-dropdown-menu', ViewDropdownMenu);
}
