import { AppSidebarService } from '@polycanvas/core/modules/app-sidebar';
import { DesktopApiService } from '@polycanvas/core/modules/desktop-api';
import {
  GlobalDialogService,
  WorkspaceDialogService,
} from '@polycanvas/core/modules/dialogs';
import { I18nService } from '@polycanvas/core/modules/i18n';
import { UrlService } from '@polycanvas/core/modules/url';
import { WorkbenchService } from '@polycanvas/core/modules/workbench';
import { WorkspaceService } from '@polycanvas/core/modules/workspace';
import { useI18n } from '@polycanvas/i18n';
import {
  useService,
  useServiceOptional,
  useServices,
} from '@toeverything/infra';
import { useStore } from 'jotai';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';

import { usePageHelper } from '../../blockmind/block-suite-page-list/utils';
import {
  PreconditionStrategy,
  registerPolymindCommand,
  registerPolymindCreationCommands,
  registerPolymindHelpCommands,
  registerPolymindLanguageCommands,
  registerPolymindLayoutCommands,
  registerPolymindNavigationCommands,
  registerPolymindSettingsCommands,
  registerPolymindUpdatesCommands,
} from '../../commands';
import { EditorSettingService } from '../../modules/editor-setting';
import { CMDKQuickSearchService } from '../../modules/quicksearch/services/cmdk';
import { useNavigateHelper } from './use-navigate-helper';

function registerCMDKCommand(service: CMDKQuickSearchService) {
  return registerPolymindCommand({
    id: 'polymind:show-quick-search',
    preconditionStrategy: PreconditionStrategy.Never,
    category: 'polymind:general',
    keyBinding: {
      binding: '$mod+K',
    },
    label: '',
    icon: '',
    run() {
      service.toggle();
    },
  });
}

export function useRegisterWorkspaceCommands() {
  const store = useStore();
  const t = useI18n();
  const theme = useTheme();
  const currentWorkspace = useService(WorkspaceService).workspace;
  const urlService = useService(UrlService);
  const pageHelper = usePageHelper(currentWorkspace.docCollection);
  const navigationHelper = useNavigateHelper();
  const {
    cMDKQuickSearchService,
    editorSettingService,
    workspaceDialogService,
    globalDialogService,
    appSidebarService,
    i18nService,
  } = useServices({
    CMDKQuickSearchService,
    EditorSettingService,
    WorkspaceDialogService,
    GlobalDialogService,
    AppSidebarService,
    I18nService,
  });

  const i18n = i18nService.i18n;

  const desktopApiService = useServiceOptional(DesktopApiService);
  const workbenchService = useServiceOptional(WorkbenchService);

  const quitAndInstall = desktopApiService?.handler.updater.quitAndInstall;

  useEffect(() => {
    const unsub = registerCMDKCommand(cMDKQuickSearchService);

    return () => {
      unsub();
    };
  }, [cMDKQuickSearchService]);

  // register PolymindUpdatesCommands
  useEffect(() => {
    if (!quitAndInstall) {
      return;
    }

    const unsub = registerPolymindUpdatesCommands({
      store,
      t,
      quitAndInstall,
    });

    return () => {
      unsub();
    };
  }, [quitAndInstall, store, t]);

  // register PolymindNavigationCommands
  useEffect(() => {
    const unsub = registerPolymindNavigationCommands({
      t,
      docCollection: currentWorkspace.docCollection,
      navigationHelper,
      workspaceDialogService,
      workbenchService,
    });

    return () => {
      unsub();
    };
  }, [
    store,
    t,
    currentWorkspace.docCollection,
    navigationHelper,
    globalDialogService,
    workspaceDialogService,
    workbenchService,
  ]);

  // register PolymindSettingsCommands
  useEffect(() => {
    const unsub = registerPolymindSettingsCommands({
      store,
      t,
      theme,
      editorSettingService,
    });

    return () => {
      unsub();
    };
  }, [editorSettingService, store, t, theme]);

  useEffect(() => {
    const unsub = registerPolymindLanguageCommands({
      i18n,
      t,
    });

    return () => {
      unsub();
    };
  }, [i18n, t]);

  // register PolymindLayoutCommands
  useEffect(() => {
    const unsub = registerPolymindLayoutCommands({ t, appSidebarService });

    return () => {
      unsub();
    };
  }, [appSidebarService, store, t]);

  // register PolymindCreationCommands
  useEffect(() => {
    const unsub = registerPolymindCreationCommands({
      globalDialogService,
      pageHelper: pageHelper,
      t,
    });

    return () => {
      unsub();
    };
  }, [store, pageHelper, t, globalDialogService]);

  // register PolymindHelpCommands
  useEffect(() => {
    const unsub = registerPolymindHelpCommands({
      t,
      urlService,
      workspaceDialogService,
    });

    return () => {
      unsub();
    };
  }, [t, globalDialogService, urlService, workspaceDialogService]);
}
