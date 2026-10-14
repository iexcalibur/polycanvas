import { EmbedLinkedDocBlockComponent } from './embed-linked-doc-block';
import { EmbedEdgelessLinkedDocBlockComponent } from './embed-linked-doc-block/embed-edgeless-linked-doc-block';
import { EmbedSyncedDocBlockComponent } from './embed-synced-doc-block';
import { EmbedSyncedDocCard } from './embed-synced-doc-block/components/embed-synced-doc-card';
import { EmbedEdgelessSyncedDocBlockComponent } from './embed-synced-doc-block/embed-edgeless-synced-doc-block';

export function effects() {
  customElements.define('polymind-embed-synced-doc-card', EmbedSyncedDocCard);

  customElements.define(
    'polymind-embed-edgeless-linked-doc-block',
    EmbedEdgelessLinkedDocBlockComponent
  );
  customElements.define(
    'polymind-embed-linked-doc-block',
    EmbedLinkedDocBlockComponent
  );

  customElements.define(
    'polymind-embed-edgeless-synced-doc-block',
    EmbedEdgelessSyncedDocBlockComponent
  );
  customElements.define(
    'polymind-embed-synced-doc-block',
    EmbedSyncedDocBlockComponent
  );
}

declare global {
  interface HTMLElementTagNameMap {
    'polymind-embed-synced-doc-card':  EmbedSyncedDocCard;
    'polymind-embed-synced-doc-block':  EmbedSyncedDocBlockComponent;
    'polymind-embed-edgeless-synced-doc-block':  EmbedEdgelessSyncedDocBlockComponent;
    'polymind-embed-linked-doc-block':  EmbedLinkedDocBlockComponent;
    'polymind-embed-edgeless-linked-doc-block':  EmbedEdgelessLinkedDocBlockComponent;
  }
}
