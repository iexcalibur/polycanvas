import {
  SettingHeader,
  SettingRow,
  SettingWrapper,
} from '@polycanvas/component/setting-components';

import * as styles from './style.css';

export const AboutPolymind = () => {
  return (
    <>
      <SettingHeader
        title="About PolyCanvas"
        subtitle="An infinite canvas for your ideas"
        data-testid="about-title"
      />
      <SettingWrapper title="Version">
        <SettingRow
          name="PolyCanvas"
          desc={BUILD_CONFIG.appVersion}
          className={styles.appImageRow}
        />
        <SettingRow name="Editor" desc={BUILD_CONFIG.editorVersion} />
      </SettingWrapper>
      <SettingWrapper title="About">
        <p style={{ padding: '0 16px', lineHeight: 1.6, opacity: 0.7 }}>
          PolyCanvas is a local-first infinite canvas for sketching,
          diagramming and thinking visually. Your data stays on your device.
          No cloud, no accounts, no subscriptions.
        </p>
      </SettingWrapper>
    </>
  );
};
