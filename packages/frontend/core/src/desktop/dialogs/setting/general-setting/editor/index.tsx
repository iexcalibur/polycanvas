import { SettingHeader } from '@polycanvas/component/setting-components';
import { useI18n } from '@polycanvas/i18n';

import { Edgeless } from './edgeless';
import { General } from './general';

export const EditorSettings = () => {
  const t = useI18n();

  return (
    <>
      <SettingHeader
        title={t['com.polymind.settings.editorSettings.title']()}
        subtitle={t['com.polymind.settings.editorSettings.subtitle']()}
      />
      <General />
      <Edgeless />

      {/* // TODO(@EYHN): implement export and import
       <Preferences /> */}
    </>
  );
};
