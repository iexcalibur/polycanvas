import { getViewManager } from '@polycanvas/core/blockmind/manager/view';
import { DebugLogger } from '@polycanvas/debug';
import { BlockStdScope } from '@blockmind/polymind/std';
import type { Store } from '@blockmind/polymind/store';
import { useMemo } from 'react';

const logger = new DebugLogger('doc-info');
// todo(pengx17): use rc pool?
export function createBlockStdScope(doc: Store) {
  logger.debug('createBlockStdScope', doc.id);
  const std = new BlockStdScope({
    store: doc,
    extensions: getViewManager().config.init().value.get('page'),
  });
  return std;
}

export function useBlockStdScope(doc: Store) {
  return useMemo(() => createBlockStdScope(doc), [doc]);
}
