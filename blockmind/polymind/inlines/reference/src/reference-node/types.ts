import type { ReferenceInfo } from '@blockmind/polymind-model';
import type { OpenDocMode } from '@blockmind/polymind-shared/services';
import type { EditorHost } from '@blockmind/std';
import type { Subject } from 'rxjs';

export type DocLinkClickedEvent = ReferenceInfo & {
  // default is active view
  openMode?: OpenDocMode;
  event?: MouseEvent;
  host: EditorHost;
};

export type RefNodeSlots = {
  docLinkClicked: Subject<DocLinkClickedEvent>;
};
