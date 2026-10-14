import type { RouteObject } from 'react-router-dom';

export const workbenchRoutes = [
  {
    // PolyCanvas: the landing route. Opens the last canvas or creates one.
    path: '/canvas',
    lazy: () => import('./pages/workspace/canvas'),
  },
  {
    // Kept for links that still point at the old docs list; lands on a canvas.
    path: '/all',
    lazy: () => import('./pages/workspace/canvas'),
  },
  {
    path: '/trash',
    lazy: () => import('./pages/workspace/trash-page'),
  },
  {
    path: '/:pageId',
    lazy: () => import('./pages/workspace/detail-page/detail-page'),
  },
  {
    path: '/:pageId/attachments/:attachmentId',
    lazy: () => import('./pages/workspace/attachment/index'),
  },
  {
    path: '/settings',
    lazy: () => import('./pages/workspace/settings'),
  },
  {
    path: '*',
    lazy: () => import('./pages/404'),
  },
] satisfies RouteObject[];
