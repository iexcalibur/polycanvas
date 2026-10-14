import type { useI18n } from '@polycanvas/i18n';
import { SettingsIcon } from '@blocksuite/icons/rc';
import { appSettingAtom } from '@toeverything/infra';
import type { createStore } from 'jotai';
import type { useTheme } from 'next-themes';

import type { EditorSettingService } from '../modules/editor-setting';
import { registerPolymindCommand } from './registry';

export function registerPolymindSettingsCommands({
  t,
  store,
  theme,
  editorSettingService,
}: {
  t: ReturnType<typeof useI18n>;
  store: ReturnType<typeof createStore>;
  theme: ReturnType<typeof useTheme>;
  editorSettingService: EditorSettingService;
}) {
  const unsubs: Array<() => void> = [];
  const updateSettings = editorSettingService.editorSetting.set.bind(
    editorSettingService.editorSetting
  );
  const settings$ = editorSettingService.editorSetting.settings$;

  // color modes
  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:change-color-mode-to-auto',
      label: `${t['com.polymind.cmdk.polymind.color-mode.to']()} ${t[
        'com.polymind.themeSettings.system'
      ]()}`,
      category: 'polymind:settings',
      icon: <SettingsIcon />,
      preconditionStrategy: () => theme.theme !== 'system',
      run() {
        theme.setTheme('system');
      },
    })
  );
  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:change-color-mode-to-dark',
      label: `${t['com.polymind.cmdk.polymind.color-mode.to']()} ${t[
        'com.polymind.themeSettings.dark'
      ]()}`,
      category: 'polymind:settings',
      icon: <SettingsIcon />,
      preconditionStrategy: () => theme.theme !== 'dark',
      run() {
        theme.setTheme('dark');
      },
    })
  );

  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:change-color-mode-to-light',
      label: `${t['com.polymind.cmdk.polymind.color-mode.to']()} ${t[
        'com.polymind.themeSettings.light'
      ]()}`,
      category: 'polymind:settings',
      icon: <SettingsIcon />,
      preconditionStrategy: () => theme.theme !== 'light',
      run() {
        theme.setTheme('light');
      },
    })
  );

  // Font styles
  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:change-font-style-to-sans',
      label: `${t['com.polymind.cmdk.polymind.font-style.to']()} ${t[
        'com.polymind.appearanceSettings.fontStyle.sans'
      ]()}`,
      category: 'polymind:settings',
      icon: <SettingsIcon />,
      preconditionStrategy: () => settings$.value.fontFamily !== 'Sans',
      run() {
        updateSettings('fontFamily', 'Sans');
      },
    })
  );

  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:change-font-style-to-serif',
      label: `${t['com.polymind.cmdk.polymind.font-style.to']()} ${t[
        'com.polymind.appearanceSettings.fontStyle.serif'
      ]()}`,
      category: 'polymind:settings',
      icon: <SettingsIcon />,
      preconditionStrategy: () => settings$.value.fontFamily !== 'Serif',
      run() {
        updateSettings('fontFamily', 'Serif');
      },
    })
  );

  unsubs.push(
    registerPolymindCommand({
      id: 'polymind:change-font-style-to-mono',
      label: `${t['com.polymind.cmdk.polymind.font-style.to']()} ${t[
        'com.polymind.appearanceSettings.fontStyle.mono'
      ]()}`,
      category: 'polymind:settings',
      icon: <SettingsIcon />,
      preconditionStrategy: () => settings$.value.fontFamily !== 'Mono',
      run() {
        updateSettings('fontFamily', 'Mono');
      },
    })
  );

  // Layout Style
  unsubs.push(
    registerPolymindCommand({
      id: `polymind:change-client-border-style`,
      label: () => `${t['com.polymind.cmdk.polymind.client-border-style.to']()} ${t[
        store.get(appSettingAtom).clientBorder
          ? 'com.polymind.cmdk.polymind.switch-state.off'
          : 'com.polymind.cmdk.polymind.switch-state.on'
      ]()}
        `,
      category: 'polymind:settings',
      icon: <SettingsIcon />,
      preconditionStrategy: () => BUILD_CONFIG.isElectron,
      run() {
        store.set(appSettingAtom, prev => ({
          ...prev,
          clientBorder: !prev.clientBorder,
        }));
      },
    })
  );

  unsubs.push(
    registerPolymindCommand({
      id: `polymind:change-full-width-layout`,
      label: () =>
        `${t[
          settings$.value.fullWidthLayout
            ? 'com.polymind.cmdk.polymind.default-page-width-layout.standard'
            : 'com.polymind.cmdk.polymind.default-page-width-layout.full-width'
        ]()}`,
      category: 'polymind:settings',
      icon: <SettingsIcon />,
      run() {
        updateSettings('fullWidthLayout', !settings$.value.fullWidthLayout);
      },
    })
  );

  unsubs.push(
    registerPolymindCommand({
      id: `polymind:change-noise-background-on-the-sidebar`,
      label: () =>
        `${t[
          'com.polymind.cmdk.polymind.noise-background-on-the-sidebar.to'
        ]()} ${t[
          store.get(appSettingAtom).enableNoisyBackground
            ? 'com.polymind.cmdk.polymind.switch-state.off'
            : 'com.polymind.cmdk.polymind.switch-state.on'
        ]()}`,
      category: 'polymind:settings',
      icon: <SettingsIcon />,
      preconditionStrategy: () => BUILD_CONFIG.isElectron,
      run() {
        store.set(appSettingAtom, prev => ({
          ...prev,
          enableNoisyBackground: !prev.enableNoisyBackground,
        }));
      },
    })
  );

  unsubs.push(
    registerPolymindCommand({
      id: `polymind:change-translucent-ui-on-the-sidebar`,
      label: () =>
        `${t['com.polymind.cmdk.polymind.translucent-ui-on-the-sidebar.to']()} ${t[
          store.get(appSettingAtom).enableBlurBackground
            ? 'com.polymind.cmdk.polymind.switch-state.off'
            : 'com.polymind.cmdk.polymind.switch-state.on'
        ]()}`,
      category: 'polymind:settings',
      icon: <SettingsIcon />,
      preconditionStrategy: () =>
        BUILD_CONFIG.isElectron && environment.isMacOs,
      run() {
        store.set(appSettingAtom, prev => ({
          ...prev,
          enableBlurBackground: !prev.enableBlurBackground,
        }));
      },
    })
  );

  return () => {
    unsubs.forEach(unsub => unsub());
  };
}
