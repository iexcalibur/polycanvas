import type { FrameBlockModel } from '@blockmind/polymind-model';
import { createIdentifier } from '@blockmind/global/di';
import type { ExtensionType } from '@blockmind/store';
import { Subject } from 'rxjs';
export const EdgelessLegacySlotIdentifier = createIdentifier<{
  readonlyUpdated: Subject<boolean>;
  navigatorSettingUpdated: Subject<{
    hideToolbar?: boolean;
    blackBackground?: boolean;
    fillScreen?: boolean;
  }>;
  navigatorFrameChanged: Subject<FrameBlockModel>;
  fullScreenToggled: Subject<void>;

  elementResizeStart: Subject<void>;
  elementResizeEnd: Subject<void>;
  toggleNoteSlicer: Subject<void>;

  toolbarLocked: Subject<boolean>;
}>('PolymindEdgelessLegacySlotService');

export const EdgelessLegacySlotExtension: ExtensionType = {
  setup: di => {
    di.addImpl(EdgelessLegacySlotIdentifier, () => ({
      readonlyUpdated: new Subject<boolean>(),
      navigatorSettingUpdated: new Subject<{
        hideToolbar?: boolean;
        blackBackground?: boolean;
        fillScreen?: boolean;
      }>(),
      navigatorFrameChanged: new Subject<FrameBlockModel>(),
      fullScreenToggled: new Subject(),
      elementResizeStart: new Subject(),
      elementResizeEnd: new Subject(),
      toggleNoteSlicer: new Subject(),
      toolbarLocked: new Subject<boolean>(),
    }));
  },
};
