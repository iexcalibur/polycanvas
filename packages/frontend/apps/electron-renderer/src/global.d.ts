import type { apis, events } from '@polycanvas/electron-api';

/**
 * Extends the global Window interface to include PolyMind's
 * Electron bridge APIs and event emitters.
 */
declare global {
  interface Window {
    __apis?: {
      apis: typeof apis;
      events: typeof events;
    };
  }
}

export {};
