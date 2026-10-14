import { AttachmentBlockComponent } from './attachment-block';
import { AttachmentEdgelessBlockComponent } from './attachment-edgeless-block';

export function effects() {
  customElements.define(
    'polymind-edgeless-attachment',
    AttachmentEdgelessBlockComponent
  );
  customElements.define('polymind-attachment', AttachmentBlockComponent);
}
