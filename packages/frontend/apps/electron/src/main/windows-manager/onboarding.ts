import { join } from 'node:path';

import { BrowserWindow, screen } from 'electron';

import { onboardingViewUrl } from '../../shared/internal-origin';
import { isDev } from '../config';
// import { getExposedMeta } from './exposed';
import { logger } from '../logger';
import { buildWebPreferences } from '../web-preferences';
import { fullscreenAndCenter, getScreenSize } from './utils';

// todo: not all window need all of the exposed meta
const getWindowAdditionalArguments = async () => {
  const { getExposedMeta } = await import('../exposed');
  const mainExposedMeta = getExposedMeta();
  return [
    `--main-exposed-meta=` + JSON.stringify(mainExposedMeta),
    `--window-name=onboarding`,
  ];
};

async function createOnboardingWindow(additionalArguments: string[]) {
  logger.info('creating onboarding window');

  const browserWindow = new BrowserWindow({
    width: 800,
    height: 600,
    frame: false,
    show: false,
    resizable: false,
    minimizable: false,
    titleBarStyle: 'hidden',
    maximizable: false,
    fullscreenable: false,
    backgroundColor: '#ffffff',
    roundedCorners: true,
    center: true,
    webPreferences: buildWebPreferences({
      webgl: true,
      preload: join(__dirname, './preload.js'),
      additionalArguments: additionalArguments,
    }),
  });

  browserWindow.on('ready-to-show', () => {
    browserWindow.webContents.setZoomFactor(1);
    browserWindow.show();
  });

  if (isDev) {
    browserWindow.webContents.openDevTools();
  }

  await browserWindow.loadURL(onboardingViewUrl);

  return browserWindow;
}

let onBoardingWindow: Promise<BrowserWindow> | undefined;

export async function getOrCreateOnboardingWindow() {
  const additionalArguments = await getWindowAdditionalArguments();
  if (
    !onBoardingWindow ||
    (await onBoardingWindow.then(w => w.isDestroyed()))
  ) {
    onBoardingWindow = createOnboardingWindow(additionalArguments);
  }

  return onBoardingWindow;
}

export async function getOnboardingWindow() {
  if (!onBoardingWindow) return;
  const window = await onBoardingWindow;
  if (window.isDestroyed()) return;
  return window;
}
