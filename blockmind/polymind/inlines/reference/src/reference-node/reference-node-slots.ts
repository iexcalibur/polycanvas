import type { ReferenceInfo } from '@blockmind/polymind-model';
import type { OpenDocMode } from '@blockmind/polymind-shared/services';
import { createIdentifier } from '@blockmind/global/di';
import type { EditorHost } from '@blockmind/std';
import type { ExtensionType } from '@blockmind/store';
import { Subject } from 'rxjs';

export type DocLinkClickedEvent = ReferenceInfo & {
  // default is active view
  openMode?: OpenDocMode;
  event?: MouseEvent;
  host: EditorHost;
};

export type RefNodeSlots = {
  docLinkClicked: Subject<DocLinkClickedEvent>;
};

export const RefNodeSlotsProvider =
  createIdentifier<RefNodeSlots>('PolymindRefNodeSlots');

const slots: RefNodeSlots = {
  docLinkClicked: new Subject(),
};

export const RefNodeSlotsExtension: ExtensionType = {
  setup: di => {
    di.addImpl(RefNodeSlotsProvider, () => slots);
  },
};
