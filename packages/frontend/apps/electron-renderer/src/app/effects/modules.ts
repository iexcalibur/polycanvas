import { configureElectronStateStorageImpls } from '@polycanvas/core/desktop/storage';
import { configureCommonModules } from '@polycanvas/core/modules';
import { configureAppTabsHeaderModule } from '@polycanvas/core/modules/app-tabs-header';
import { configureDesktopBackupModule } from '@polycanvas/core/modules/backup';
import {
  configureDesktopApiModule,
  DesktopApiService,
} from '@polycanvas/core/modules/desktop-api';
import {
  configureSpellCheckSettingModule,
  configureTraySettingModule,
} from '@polycanvas/core/modules/editor-setting';
import { configureFindInPageModule } from '@polycanvas/core/modules/find-in-page';
import {
  ClientSchemeProvider,
  PopupWindowProvider,
} from '@polycanvas/core/modules/url';
import { configureDesktopWorkbenchModule } from '@polycanvas/core/modules/workbench';
import { configureBrowserWorkspaceFlavours } from '@polycanvas/core/modules/workspace-engine';
import { Framework } from '@toeverything/infra';

export function setupModules() {
  const framework = new Framework();
  configureCommonModules(framework);
  configureElectronStateStorageImpls(framework);
  configureBrowserWorkspaceFlavours(framework);
  configureDesktopWorkbenchModule(framework);
  configureAppTabsHeaderModule(framework);
  configureFindInPageModule(framework);
  configureDesktopApiModule(framework);
  configureSpellCheckSettingModule(framework);
  configureTraySettingModule(framework);
  configureDesktopBackupModule(framework);

  framework.impl(PopupWindowProvider, p => {
    const apis = p.get(DesktopApiService).api;
    return {
      open: (url: string) => {
        apis.handler.ui.openExternal(url).catch(e => {
          console.error('Failed to open external URL', e);
        });
      },
    };
  });
  framework.impl(ClientSchemeProvider, p => {
    const appInfo = p.get(DesktopApiService).appInfo;
    return {
      getClientScheme() {
        return appInfo?.scheme;
      },
    };
  });
  const frameworkProvider = framework.provider();

  return { framework, frameworkProvider };
}
