import {
  createCustomToolbarExtension,
  createToolbarMoreMenuConfig,
} from '@polycanvas/core/blockmind/view-extensions/editor-config/toolbar';
import { EditorSettingService } from '@polycanvas/core/modules/editor-setting';
import { ToolbarMoreMenuConfigExtension } from '@blockmind/polymind/components/toolbar';
import { EditorSettingExtension } from '@blockmind/polymind/shared/services';
import type { ExtensionType } from '@blockmind/store';
import type { FrameworkProvider } from '@toeverything/infra';

export function getEditorConfigExtension(
  framework: FrameworkProvider
): ExtensionType[] {
  const editorSettingService = framework.get(EditorSettingService);
  const baseUrl = location.origin;

  return [
    EditorSettingExtension({
      // eslint-disable-next-line rxjs/finnish
      setting$: editorSettingService.editorSetting.settingSignal,
      set: (k, v) => editorSettingService.editorSetting.set(k, v),
    }),
    ToolbarMoreMenuConfigExtension(createToolbarMoreMenuConfig(framework)),

    createCustomToolbarExtension(editorSettingService.editorSetting, baseUrl),
  ].flat();
}
