import type { PolymindTextAttributes } from '@blockmind/polymind/shared/types';
import {
  type DeltaInsert,
  Text,
  type Workspace,
} from '@blockmind/polymind/store';
import { useCallback } from 'react';

export function useReferenceLinkHelper(docCollection: Workspace) {
  const addReferenceLink = useCallback(
    (pageId: string, referenceId: string) => {
      const page = docCollection?.getDoc(pageId)?.getStore();
      if (!page) {
        return;
      }
      const text = new Text([
        {
          insert: ' ',
          attributes: {
            reference: {
              type: 'Subpage',
              pageId: referenceId,
            },
          },
        },
      ] as DeltaInsert<PolymindTextAttributes>[]);
      const [frame] = page.getModelsByFlavour('polymind:note');

      frame && page.addBlock('polymind:paragraph', { text }, frame.id);
    },
    [docCollection]
  );

  return {
    addReferenceLink,
  };
}
