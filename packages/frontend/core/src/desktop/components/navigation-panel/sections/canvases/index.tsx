import { IconButton } from '@polycanvas/component';
import { usePageHelper } from '@polycanvas/core/blockmind/block-suite-page-list/utils';
import { DocsService } from '@polycanvas/core/modules/doc';
import { WorkspaceService } from '@polycanvas/core/modules/workspace';
import { inferOpenMode } from '@polycanvas/core/utils';
import { PlusIcon } from '@blocksuite/icons/rc';
import { LiveData, useLiveData, useServices } from '@toeverything/infra';
import { type MouseEventHandler, useCallback, useMemo } from 'react';

import { CollapsibleSection } from '../../layouts/collapsible-section';
import { NavigationPanelDocNode } from '../../nodes/doc';
import { NavigationPanelTreeRoot } from '../../tree';

const location = { at: 'navigation-panel:canvases:list' as const };

const Empty = () => (
  <div style={{ padding: '8px 12px', fontSize: 12, opacity: 0.6 }}>
    No canvases yet
  </div>
);

/**
 * PolyCanvas sidebar section: every canvas in the workspace, most recently
 * updated first. Replaces Polymind's All docs / tags / collections / organize.
 */
export const NavigationPanelCanvases = () => {
  const { docsService, workspaceService } = useServices({
    DocsService,
    WorkspaceService,
  });

  const path = useMemo(() => ['canvases'], []);

  const docIds$ = useMemo(
    () =>
      LiveData.computed(get =>
        get(docsService.list.docs$)
          .map(doc => ({
            id: doc.id,
            trash: get(doc.trash$),
            updatedAt: get(doc.updatedAt$) ?? get(doc.createdAt$) ?? 0,
          }))
          .filter(doc => !doc.trash)
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .map(doc => doc.id)
      ),
    [docsService]
  );
  const docIds = useLiveData(docIds$);

  const { createPage } = usePageHelper(
    workspaceService.workspace.docCollection
  );

  const handleCreate: MouseEventHandler = useCallback(
    e => {
      createPage(undefined, { at: inferOpenMode(e) });
    },
    [createPage]
  );

  return (
    <CollapsibleSection
      path={path}
      title="Canvases"
      testId="navigation-panel-canvases"
      actions={
        <IconButton
          data-testid="navigation-panel-bar-add-canvas-button"
          onClick={handleCreate}
          onAuxClick={handleCreate}
          size="16"
          tooltip="New canvas"
        >
          <PlusIcon />
        </IconButton>
      }
    >
      <NavigationPanelTreeRoot placeholder={<Empty />}>
        {docIds.map(id => (
          <NavigationPanelDocNode
            key={id}
            docId={id}
            location={location}
            parentPath={path}
          />
        ))}
      </NavigationPanelTreeRoot>
    </CollapsibleSection>
  );
};
