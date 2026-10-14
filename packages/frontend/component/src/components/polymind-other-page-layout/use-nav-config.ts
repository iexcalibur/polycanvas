import { useI18n } from '@polycanvas/i18n';
import { useMemo } from 'react';

export const useNavConfig = () => {
  const t = useI18n();
  return useMemo(
    () => [
      {
        title: t['com.polymind.other-page.nav.official-website'](),
        path: 'https://polymind.pro',
      },
      {
        title: t['com.polymind.other-page.nav.blog'](),
        path: 'https://polymind.pro/blog',
      },
      {
        title: t['com.polymind.other-page.nav.contact-us'](),
        path: 'https://polymind.pro/about-us',
      },
    ],
    [t]
  );
};
