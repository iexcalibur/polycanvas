import type { I18n } from '@polycanvas/core/modules/i18n';
import type { useI18n } from '@polycanvas/i18n';
import { SettingsIcon } from '@blocksuite/icons/rc';

import { registerPolymindCommand } from './registry';

export function registerPolymindLanguageCommands({
  i18n,
  t,
}: {
  i18n: I18n;
  t: ReturnType<typeof useI18n>;
}) {
  // Display Language
  const disposables = i18n.languageList.map(language => {
    return registerPolymindCommand({
      id: `polymind:change-display-language-to-${language.name}`,
      label: `${t['com.polymind.cmdk.polymind.display-language.to']()} ${
        language.originalName
      }`,
      category: 'polymind:settings',
      icon: <SettingsIcon />,
      preconditionStrategy: () =>
        i18n.currentLanguage$.value.key !== language.key,
      run() {
        i18n.changeLanguage(language.key);
      },
    });
  });

  return () => {
    disposables.forEach(dispose => dispose());
  };
}
