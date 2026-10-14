import { CitationCard } from './citation';

export * from './citation';

export function effects() {
  customElements.define('polymind-citation-card', CitationCard);
}
