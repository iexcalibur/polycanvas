import {
  PreconditionStrategy,
  registerPolymindCommand,
} from '@polycanvas/core/commands';
import { useService } from '@toeverything/infra';
import { useEffect } from 'react';

import { NavigatorService } from '../services/navigator';

export function useRegisterNavigationCommands() {
  const navigator = useService(NavigatorService).navigator;
  useEffect(() => {
    const unsubs: Array<() => void> = [];

    unsubs.push(
      registerPolymindCommand({
        id: 'polymind:shortcut-history-go-back',
        category: 'polymind:general',
        preconditionStrategy: PreconditionStrategy.Never,
        icon: 'none',
        label: 'go back',
        keyBinding: {
          binding: '$mod+[',
        },
        run() {
          navigator.back();
        },
      })
    );
    unsubs.push(
      registerPolymindCommand({
        id: 'polymind:shortcut-history-go-forward',
        category: 'polymind:general',
        preconditionStrategy: PreconditionStrategy.Never,
        icon: 'none',
        label: 'go forward',
        keyBinding: {
          binding: '$mod+]',
        },
        run() {
          navigator.forward();
        },
      })
    );

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [navigator]);
}
