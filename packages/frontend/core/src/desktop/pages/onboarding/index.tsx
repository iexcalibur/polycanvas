import { Button, ThemedImg } from '@polycanvas/component';
import {
  dotBgDark,
  dotBgLight,
  illustrationDark,
  illustrationLight,
} from '@polycanvas/component/polymind-other-page-layout';
import { DesktopApiService } from '@polycanvas/core/modules/desktop-api';
import { useServiceOptional } from '@toeverything/infra';
import { useTheme } from 'next-themes';
import { useCallback } from 'react';

import Logo from '../../../components/polymind/onboarding/assets/logo';
import * as styles from './style.css';

export const Component = () => {
  const desktopApi = useServiceOptional(DesktopApiService);
  const { resolvedTheme } = useTheme();

  const backgroundImage =
    resolvedTheme === 'dark' && dotBgDark ? dotBgDark : dotBgLight;

  const onGetStarted = useCallback(() => {
    desktopApi?.handler.ui.handleOpenMainApp().catch(console.error);
  }, [desktopApi]);

  return (
    <div
      className={styles.container}
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className={styles.content}>
        <Logo />
        <h1 className={styles.title}>Well Done !</h1>
        <p className={styles.subtitle}>
          You have the flexibility to switch between Page and Edgeless
          <br /> Mode at any point during content creation.
        </p>
        <Button
          onClick={onGetStarted}
          variant="primary"
          size="extraLarge"
          style={{ marginTop: 40 }}
        >
          Get Started
        </Button>
      </div>
      <ThemedImg
        draggable={false}
        className={styles.illustration}
        lightSrc={illustrationLight}
        darkSrc={illustrationDark}
      />
    </div>
  );
};
