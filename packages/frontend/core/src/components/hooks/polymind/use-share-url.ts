import { notify } from '@polycanvas/component';
import { toDocSearchParams } from '@polycanvas/core/modules/navigation';
import { copyTextToClipboard } from '@polycanvas/core/utils/clipboard';
import { useI18n } from '@polycanvas/i18n';
import type { SerializedXYWH } from '@blockmind/polymind/global/gfx';
import { type DocMode } from '@blockmind/polymind/model';
import {
  getBlockSelectionsCommand,
  getImageSelectionsCommand,
  getSelectedModelsCommand,
  getTextSelectionCommand,
} from '@blockmind/polymind/shared/commands';
import { type EditorHost } from '@blockmind/polymind/std';
import {
  GfxBlockElementModel,
  GfxControllerIdentifier,
} from '@blockmind/polymind/std/gfx';
import { useCallback } from 'react';

export type UseSharingUrl = {
  workspaceId: string;
  pageId: string;
  mode?: DocMode;
  blockIds?: string[];
  elementIds?: string[];
  xywh?: SerializedXYWH; // not needed currently
};

/**
 * To generate a url like
 *
 * https://app.polymind.pro/workspace/workspaceId/docId?mode=DocMode&elementIds=seletedElementIds&blockIds=selectedBlockIds
 */
export const generateUrl = ({
  baseUrl,
  workspaceId,
  pageId,
  blockIds,
  elementIds,
  mode,
  xywh, // not needed currently
}: UseSharingUrl & { baseUrl: string }) => {
  try {
    const url = new URL(`/workspace/${workspaceId}/${pageId}`, baseUrl);
    const search = toDocSearchParams({ mode, blockIds, elementIds, xywh });
    if (search?.size) url.search = search.toString();
    return url.toString();
  } catch (err) {
    console.error(err);
    return undefined;
  }
};

const getShareLinkType = ({
  mode,
  blockIds,
  elementIds,
}: {
  mode?: DocMode;
  blockIds?: string[];
  elementIds?: string[];
}) => {
  if (mode === 'page') {
    return 'doc';
  } else if (mode === 'edgeless') {
    return 'whiteboard';
  } else if (blockIds && blockIds.length > 0) {
    return 'block';
  } else if (elementIds && elementIds.length > 0) {
    return 'element';
  } else {
    return 'default';
  }
};

export const getSelectedNodes = (
  host: EditorHost | null,
  mode: DocMode = 'page'
) => {
  const std = host?.std;
  const blockIds: string[] = [];
  const elementIds: string[] = [];
  const result = { blockIds, elementIds };

  if (!std) {
    return result;
  }

  if (mode === 'edgeless') {
    const { selection } = std.get(GfxControllerIdentifier);

    for (const element of selection.selectedElements) {
      if (element instanceof GfxBlockElementModel) {
        blockIds.push(element.id);
      } else {
        elementIds.push(element.id);
      }
    }

    return result;
  }

  const [success, ctx] = std.command
    .chain()
    .tryAll(chain => [
      chain.pipe(getTextSelectionCommand),
      chain.pipe(getBlockSelectionsCommand),
      chain.pipe(getImageSelectionsCommand),
    ])
    .pipe(getSelectedModelsCommand, {
      mode: 'highest',
    })
    .run();

  if (!success) {
    return result;
  }

  // should return an empty array if `to` of the range is null
  if (
    ctx.currentTextSelection &&
    !ctx.currentTextSelection.to &&
    ctx.currentTextSelection.from.length === 0
  ) {
    return result;
  }

  if (ctx.selectedModels?.length) {
    blockIds.push(...ctx.selectedModels.map(model => model.id));
    return result;
  }

  return result;
};

export const useSharingUrl = ({ workspaceId, pageId }: UseSharingUrl) => {
  const t = useI18n();

  const onClickCopyLink = useCallback(
    (mode?: DocMode, blockIds?: string[], elementIds?: string[]) => {
      const sharingUrl = generateUrl({
        baseUrl: location.origin,
        workspaceId,
        pageId,
        blockIds,
        elementIds,
        mode, // if view is not provided, use the current view
      });
      const _type = getShareLinkType({
        mode,
        blockIds,
        elementIds,
      });
      if (sharingUrl) {
        copyTextToClipboard(sharingUrl)
          .then(success => {
            if (success) {
              notify.success({ title: t['Copied link to clipboard']() });
            }
          })
          .catch(err => {
            console.error(err);
          });
      } else {
        notify.error({ title: 'Network not available' });
      }
    },
    [pageId, t, workspaceId]
  );

  return {
    onClickCopyLink,
  };
};
