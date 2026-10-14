import type { Store } from '@blockmind/polymind/store';
import {
  DragHandle,
  type InlineEditHandle,
  observeResize,
  useDraggable,
} from '@polycanvas/component';
import { FavoriteButton } from '@polycanvas/core/blockmind/block-suite-header/favorite';
import { InfoButton } from '@polycanvas/core/blockmind/block-suite-header/info';
import { PageHeaderMenuButton } from '@polycanvas/core/blockmind/block-suite-header/menu';
import { DetailPageHeaderPresentButton } from '@polycanvas/core/blockmind/block-suite-header/present/detail-header-present-button';
import { BlocksuiteHeaderTitle } from '@polycanvas/core/blockmind/block-suite-header/title';
import { useRegisterCopyLinkCommands } from '@polycanvas/core/components/hooks/polymind/use-register-copy-link-commands';
import { DocDisplayMetaService } from '@polycanvas/core/modules/doc-display-meta';
import { ViewIcon, ViewTitle } from '@polycanvas/core/modules/workbench';
import type { Workspace } from '@polycanvas/core/modules/workspace';
import type { PolymindDNDData } from '@polycanvas/core/types/dnd';
import { useI18n } from '@polycanvas/i18n';
import { useLiveData, useService } from '@toeverything/infra';
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import * as styles from './detail-page-header.css';
import { useDetailPageHeaderResponsive } from './use-header-responsive';

const Header = forwardRef<
  HTMLDivElement,
  {
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
  }
>(({ children, style, className }, ref) => {
  return (
    <div data-testid="header" style={style} className={className} ref={ref}>
      {children}
    </div>
  );
});

Header.displayName = 'forwardRef(Header)';

interface PageHeaderProps {
  page: Store;
  workspace: Workspace;
}
export function NormalPageHeader({ page }: PageHeaderProps) {
  const titleInputHandleRef = useRef<InlineEditHandle>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    return observeResize(container, entry => {
      setContainerWidth(entry.contentRect.width);
    });
  }, []);

  const { hideCollect, hidePresent } =
    useDetailPageHeaderResponsive(containerWidth);

  const onRename = useCallback(() => {
    setTimeout(
      () => titleInputHandleRef.current?.triggerEdit(),
      500 /* wait for menu animation end */
    );
  }, []);

  const docDisplayMetaService = useService(DocDisplayMetaService);
  const i18n = useI18n();
  const title = i18n.t(useLiveData(docDisplayMetaService.title$(page.id)));

  return (
    <Header className={styles.header} ref={containerRef}>
      <ViewTitle title={title} />
      <ViewIcon icon="edgeless" />
      <BlocksuiteHeaderTitle inputHandleRef={titleInputHandleRef} />
      <div className={styles.iconButtonContainer}>
        {hideCollect ? null : (
          <>
            <FavoriteButton pageId={page?.id} />
            <InfoButton docId={page.id} />
          </>
        )}
        <PageHeaderMenuButton
          rename={onRename}
          page={page}
          containerWidth={containerWidth}
        />
      </div>

      <div className={styles.spacer} />

      {!hidePresent ? <DetailPageHeaderPresentButton /> : null}
    </Header>
  );
}

export function DetailPageHeader(
  props: PageHeaderProps & {
    onDragging?: (dragging: boolean) => void;
  }
) {
  const { page, workspace, onDragging } = props;

  useRegisterCopyLinkCommands({
    workspaceMeta: workspace.meta,
    docId: page.id,
  });

  const { dragRef, dragging, CustomDragPreview } =
    useDraggable<PolymindDNDData>(() => {
      return {
        data: {
          from: {
            at: 'doc-detail:header',
            docId: page.id,
          },
          entity: {
            type: 'doc',
            id: page.id,
          },
        },
        canDrag: args => {
          // hack for preventing drag when editing the page title
          const editingElement =
            args.element.contains(document.activeElement) &&
            document.activeElement?.tagName === 'INPUT';
          return !editingElement;
        },
        onDragStart: () => {},
        dragPreviewPosition: 'pointer-outside',
      };
    }, [page.id]);

  const inner = <NormalPageHeader {...props} />;

  useEffect(() => {
    onDragging?.(dragging);
  }, [dragging, onDragging]);

  return (
    <>
      <div className={styles.root} ref={dragRef} data-dragging={dragging}>
        <DragHandle dragging={dragging} className={styles.dragHandle} />
        {inner}
      </div>
      <CustomDragPreview>
        <div className={styles.dragPreview}>{inner}</div>
      </CustomDragPreview>
    </>
  );
}
