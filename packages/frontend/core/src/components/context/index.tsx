import { ConfirmModalProvider, PromptModalProvider } from '@polycanvas/component';
import { ProviderComposer } from '@polycanvas/component/provider-composer';
import { ThemeProvider } from '@polycanvas/core/components/theme-provider';
import type { createStore } from 'jotai';
import { Provider } from 'jotai';
import type { PropsWithChildren } from 'react';
import { useMemo } from 'react';

import { useImageAntialiasing } from '../hooks/use-image-antialiasing';

export type PolymindContextProps = PropsWithChildren<{
  store?: ReturnType<typeof createStore>;
}>;

export function PolymindContext(props: PolymindContextProps) {
  useImageAntialiasing();
  return (
    <ProviderComposer
      contexts={useMemo(
        () =>
          [
            <Provider key="JotaiProvider" store={props.store} />,
            <ThemeProvider key="ThemeProvider" />,
            <ConfirmModalProvider key="ConfirmModalProvider" />,
            <PromptModalProvider key="PromptModalProvider" />,
          ].filter(Boolean),
        [props.store]
      )}
    >
      {props.children}
    </ProviderComposer>
  );
}
