import { useEffect, useState } from 'react';
import type { RouteObject } from 'react-router-dom';
import {
  createBrowserRouter as reactRouterCreateBrowserRouter,
  useNavigate,
} from 'react-router-dom';

import { PolymindErrorComponent } from '../components/polymind/polymind-error-boundary/polymind-error-fallback';
import { NavigateContext } from '../components/hooks/use-navigate-helper';
import { RootWrapper } from './pages/root';
import {
  CATCH_ALL_ROUTE_PATH,
  NOT_FOUND_ROUTE_PATH,
  WORKSPACE_ROUTE_PATH,
} from './route-paths';

export function RootRouter() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
  }, []);

  return (
    ready && (
      <NavigateContext.Provider value={navigate}>
        <RootWrapper />
      </NavigateContext.Provider>
    )
  );
}

export const topLevelRoutes = [
  {
    element: <RootRouter />,
    errorElement: <PolymindErrorComponent />,
    children: [
      {
        path: '/',
        lazy: () => import('./pages/index'),
      },
      {
        path: WORKSPACE_ROUTE_PATH,
        lazy: () => import('./pages/workspace/index'),
      },
      {
        path: '/onboarding',
        lazy: () => import('./pages/onboarding'),
      },
      {
        path: '/theme-editor',
        lazy: () => import('./pages/theme-editor'),
      },
      {
        path: NOT_FOUND_ROUTE_PATH,
        lazy: () => import('./pages/404'),
      },
      {
        path: CATCH_ALL_ROUTE_PATH,
        lazy: () => import('./pages/404'),
      },
    ],
  },
] satisfies [RouteObject, ...RouteObject[]];

export const router = reactRouterCreateBrowserRouter(topLevelRoutes, {
  basename: environment.subPath,
  future: {
    v7_normalizeFormMethod: true,
  },
});
