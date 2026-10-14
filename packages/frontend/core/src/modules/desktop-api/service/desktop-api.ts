import { OnEvent, Service } from '@toeverything/infra';
import type { To } from 'history';
import { debounce } from 'lodash-es';

import { ApplicationStarted } from '../../lifecycle';
import type { DesktopApi } from '../entities/electron-api';

@OnEvent(ApplicationStarted, e => e.setupStartListener)
export class DesktopApiService extends Service {
  constructor(public readonly api: DesktopApi) {
    super();
    if (!api.handler || !api.events) {
      throw new Error('DesktopApi is not initialized');
    }
  }

  get appInfo() {
    return this.api.appInfo;
  }

  get handler() {
    return this.api.handler;
  }

  get events() {
    return this.api.events;
  }

  get sharedStorage() {
    return this.api.sharedStorage;
  }

  async showTab(tabId: string, to?: To) {
    if (to) {
      const url = new URL(to.toString());
      const tabs = await this.api.handler.ui.getTabViewsMeta();
      const tab = tabs.workbenches.find(t => t.id === tabId);
      if (tab) {
        const basename = tab.basename;
        if (url.pathname.startsWith(basename)) {
          const pathname = url.pathname.slice(basename.length);
          await this.api.handler.ui.tabGoTo(
            tabId,
            pathname + url.search + url.hash
          );
        }
      }
    }
    await this.api.handler.ui.showTab(tabId);
  }

  private setupStartListener() {
    this.setupCommonUIEvents();
  }

  private setupCommonUIEvents() {
    if (this.api.appInfo.windowName !== 'main') {
      return;
    }

    const handleMaximized = (maximized: boolean | undefined) => {
      document.documentElement.dataset.maximized = String(maximized);
    };
    const handleFullscreen = (fullscreen: boolean | undefined) => {
      document.documentElement.dataset.fullscreen = String(fullscreen);
    };
    this.api.handler.ui
      .isMaximized()
      .then(handleMaximized)
      .catch(console.error);
    this.api.handler.ui
      .isFullScreen()
      .then(handleFullscreen)
      .catch(console.error);

    this.api.events.ui.onMaximized(handleMaximized);
    this.api.events.ui.onFullScreen(handleFullscreen);

    const tabId = this.api.appInfo.viewId;

    if (tabId) {
      let isActive = false;
      const handleActiveTabChange = (active: boolean) => {
        isActive = active;
        document.documentElement.dataset.active = String(active);
      };
      this.api.handler.ui
        .isActiveTab()
        .then(active => {
          handleActiveTabChange(active);
          this.api.events.ui.onActiveTabChanged(id => {
            handleActiveTabChange(id === tabId);
          });
        })
        .catch(console.error);

      const handleResize = debounce(() => {
        if (isActive) {
          this.api.handler.ui.handleWindowResize().catch(console.error);
        }
      }, 50);
      window.addEventListener('resize', handleResize);
      window.addEventListener('dragstart', () => {
        document.documentElement.dataset.dragging = 'true';
      });
      window.addEventListener('dragend', () => {
        document.documentElement.dataset.dragging = 'false';
      });
    }
  }

}
