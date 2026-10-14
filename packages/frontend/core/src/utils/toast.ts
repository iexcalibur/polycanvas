import type { ToastOptions } from '@polycanvas/component';
import { toast as basicToast } from '@polycanvas/component';

export const toast = (message: string, options?: ToastOptions) => {
  const modal = document.querySelector<HTMLDivElement>('[role=presentation]');
  if (modal && !(modal instanceof HTMLDivElement)) {
    throw new Error('modal should be div');
  }
  return basicToast(message, {
    portal: modal || document.body,
    ...options,
  });
};

declare global {
  // global Events
  interface WindowEventMap {
    'polymind-toast:emit': CustomEvent<{
      message: string;
    }>;
  }
}
