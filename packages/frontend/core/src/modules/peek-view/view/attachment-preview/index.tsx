import { AttachmentViewer } from '@polycanvas/core/blockmind/attachment-viewer';
import type { AttachmentBlockModel } from '@blockmind/polymind/model';
import { useMemo } from 'react';

import { useEditor } from '../utils';

export type AttachmentPreviewModalProps = {
  docId: string;
  blockId: string;
};

export const AttachmentPreviewPeekView = ({
  docId,
  blockId,
}: AttachmentPreviewModalProps) => {
  const { doc } = useEditor(docId);
  const blockmindDoc = doc?.blockSuiteDoc;
  const model = useMemo(
    () => blockmindDoc?.getModelById<AttachmentBlockModel>(blockId) ?? null,
    [blockId, blockmindDoc]
  );

  if (model) {
    return <AttachmentViewer model={model} />;
  }

  return null;
};
