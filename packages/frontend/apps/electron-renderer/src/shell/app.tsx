import { useAppSettingHelper } from '@polycanvas/core/components/hooks/polymind/use-app-setting-helper';
import { WindowsAppControls } from '@polycanvas/core/components/pure/header/windows-app-controls';
import { ThemeProvider } from '@polycanvas/core/components/theme-provider';
import { configureElectronStateStorageImpls } from '@polycanvas/core/desktop/storage';
import { configureAppSidebarModule } from '@polycanvas/core/modules/app-sidebar';
import { ShellAppSidebarFallback } from '@polycanvas/core/modules/app-sidebar/views';
import {
  AppTabsHeader,
  configureAppTabsHeaderModule,
} from '@polycanvas/core/modules/app-tabs-header';
import { configureDesktopApiModule } from '@polycanvas/core/modules/desktop-api';
import { configureI18nModule, I18nProvider } from '@polycanvas/core/modules/i18n';
import { configureStorageModule } from '@polycanvas/core/modules/storage';
import { configureAppThemeModule } from '@polycanvas/core/modules/theme';
import { Framework, FrameworkRoot } from '@toeverything/infra';

import * as styles from './app.css';

const framework = new Framework();
configureStorageModule(framework);
configureElectronStateStorageImpls(framework);
configureAppTabsHeaderModule(framework);
configureAppSidebarModule(framework);
configureI18nModule(framework);
configureDesktopApiModule(framework);
configureAppThemeModule(framework);
const frameworkProvider = framework.provider();

export function App() {
  const { appSettings } = useAppSettingHelper();
  const translucent =
    BUILD_CONFIG.isElectron &&
    environment.isMacOs &&
    appSettings.enableBlurBackground;

  return (
    <FrameworkRoot framework={frameworkProvider}>
      <ThemeProvider>
        <I18nProvider>
          <div className={styles.root} data-translucent={translucent}>
            <AppTabsHeader mode="shell" className={styles.appTabsHeader} />
            <div className={styles.body}>
              <ShellAppSidebarFallback />
            </div>
            {environment.isWindows && (
              <div style={{ position: 'fixed', right: 0, top: 0, zIndex: 5 }}>
                <WindowsAppControls />
              </div>
            )}
          </div>
        </I18nProvider>
      </ThemeProvider>
    </FrameworkRoot>
  );
}
