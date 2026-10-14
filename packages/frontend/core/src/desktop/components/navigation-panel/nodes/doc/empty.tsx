import { type DropTargetDropEvent, useDropTarget } from '@polycanvas/component';
import type { PolymindDNDData } from '@polycanvas/core/types/dnd';
import { useI18n } from '@polycanvas/i18n';

import { EmptyNodeChildren } from '../../layouts/empty-node-children';

export const Empty = ({
  onDrop,
  noAccessible = false,
}: {
  onDrop: (data: DropTargetDropEvent<PolymindDNDData>) => void;
  noAccessible?: boolean;
}) => {
  const { dropTargetRef } = useDropTarget<PolymindDNDData>(
    () => ({
      onDrop,
    }),
    [onDrop]
  );
  const t = useI18n();

  return (
    <EmptyNodeChildren ref={dropTargetRef}>
      {noAccessible
        ? t['com.polymind.share-menu.option.permission.no-access']()
        : t['com.polymind.rootAppSidebar.docs.no-subdoc']()}
    </EmptyNodeChildren>
  );
};
