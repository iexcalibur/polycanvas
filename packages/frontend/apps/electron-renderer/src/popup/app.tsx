import { ThemeProvider } from '@polycanvas/core/components/theme-provider';
import { configureElectronStateStorageImpls } from '@polycanvas/core/desktop/storage';
import { configureDesktopApiModule } from '@polycanvas/core/modules/desktop-api';
import { configureI18nModule, I18nProvider } from '@polycanvas/core/modules/i18n';
import { configureStorageModule } from '@polycanvas/core/modules/storage';
import { configureEssentialThemeModule } from '@polycanvas/core/modules/theme';
import { appInfo } from '@polycanvas/electron-api';
import { Framework, FrameworkRoot } from '@toeverything/infra';

import * as styles from './app.css';
import { Recording } from './recording';

const framework = new Framework();
configureI18nModule(framework);
configureEssentialThemeModule(framework);
configureStorageModule(framework);
configureElectronStateStorageImpls(framework);
configureDesktopApiModule(framework);
const frameworkProvider = framework.provider();

const mode = appInfo?.windowName as 'notification' | 'recording';

export function App() {
  return (
    <FrameworkRoot framework={frameworkProvider}>
      <ThemeProvider>
        <I18nProvider>
          <div className={styles.root} data-is-windows={environment.isWindows}>
            {mode === 'recording' && <Recording />}
          </div>
        </I18nProvider>
      </ThemeProvider>
    </FrameworkRoot>
  );
}
