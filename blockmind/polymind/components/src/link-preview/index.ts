import { LinkPreview } from './link';

export * from './link';

export function effects() {
  customElements.define('polymind-link-preview', LinkPreview);
}
