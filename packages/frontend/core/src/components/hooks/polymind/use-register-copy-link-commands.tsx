import {
  PreconditionStrategy,
  registerPolymindCommand,
} from '@polycanvas/core/commands';
import { useSharingUrl } from '@polycanvas/core/components/hooks/polymind/use-share-url';
import { useIsActiveView } from '@polycanvas/core/modules/workbench';
import type { WorkspaceMetadata } from '@polycanvas/core/modules/workspace';
import { useEffect } from 'react';

export function useRegisterCopyLinkCommands({
  workspaceMeta,
  docId,
}: {
  workspaceMeta: WorkspaceMetadata;
  docId: string;
}) {
  const isActiveView = useIsActiveView();
  const workspaceId = workspaceMeta.id;
  const isCloud = workspaceMeta.flavour !== 'local';

  const { onClickCopyLink } = useSharingUrl({
    workspaceId,
    pageId: docId,
  });

  useEffect(() => {
    if (!isActiveView) {
      return;
    }
    const unsubs: Array<() => void> = [];

    unsubs.push(
      registerPolymindCommand({
        id: `polymind:share-private-link:${docId}`,
        category: 'polymind:general',
        preconditionStrategy: PreconditionStrategy.Never,
        keyBinding: {
          binding: '$mod+Shift+c',
        },
        label: '',
        icon: null,
        run() {
          isActiveView && isCloud && onClickCopyLink();
        },
      })
    );
    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [docId, isActiveView, isCloud, onClickCopyLink]);
}
