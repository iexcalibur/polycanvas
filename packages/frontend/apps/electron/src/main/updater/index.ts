import { app } from 'electron';

import type { NamespaceHandlers } from '../type';

// Auto-updater disabled — local standalone app
export type UpdaterConfig = {
  autoCheckUpdate: boolean;
  autoDownloadUpdate: boolean;
};

export const registerUpdater = async () => {};
export const quitAndInstall = () => {};
export const checkForUpdates = async () => null;
export const downloadUpdate = async () => {};
export const getConfig = () => ({
  autoCheckUpdate: false,
  autoDownloadUpdate: false,
});
export const setConfig = (_config: Partial<UpdaterConfig>) => {};

export const updaterHandlers = {
  currentVersion: async () => {
    return app.getVersion();
  },
  quitAndInstall: async () => {},
  downloadUpdate: async () => {},
  getConfig: async (): Promise<UpdaterConfig> => {
    return { autoCheckUpdate: false, autoDownloadUpdate: false };
  },
  setConfig: async (): Promise<void> => {},
  checkForUpdates: async () => {
    return null;
  },
} satisfies NamespaceHandlers;
