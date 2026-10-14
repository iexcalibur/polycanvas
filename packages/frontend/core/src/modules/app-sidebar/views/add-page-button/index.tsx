import { IconButton } from '@polycanvas/component';
import { usePageHelper } from '@polycanvas/core/blockmind/block-suite-page-list/utils';
import { WorkspaceService } from '@polycanvas/core/modules/workspace';
import { inferOpenMode } from '@polycanvas/core/utils';
import { useI18n } from '@polycanvas/i18n';
import { PlusIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import clsx from 'clsx';
import type React from 'react';
import { type MouseEvent, useCallback } from 'react';

import * as styles from './index.css';

interface AddPageButtonProps {
  className?: string;
  style?: React.CSSProperties;
}

const sideBottom = { side: 'bottom' as const };

/**
 * Sidebar "New canvas" button. Every new doc is an edgeless canvas in
 * PolyCanvas, so there is no page/edgeless/template chooser any more.
 */
export function AddPageButton({ className, style }: AddPageButtonProps) {
  const t = useI18n();
  const workspaceService = useService(WorkspaceService);
  const pageHelper = usePageHelper(workspaceService.workspace.docCollection);

  const onClickNewPage = useCallback(
    (e?: MouseEvent) => {
      pageHelper.createPage(undefined, { at: inferOpenMode(e) });
    },
    [pageHelper]
  );

  return (
    <IconButton
      tooltip={t['New Page']()}
      tooltipOptions={sideBottom}
      data-testid="sidebar-new-page-button"
      style={style}
      className={clsx([styles.root, className])}
      size={16}
      onClick={onClickNewPage}
      onAuxClick={onClickNewPage}
    >
      <PlusIcon />
    </IconButton>
  );
}
