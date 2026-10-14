import { DocsService } from '@polycanvas/core/modules/doc';
import { DocDisplayMetaService } from '@polycanvas/core/modules/doc-display-meta';
import { PeekViewService } from '@polycanvas/core/modules/peek-view/services/peek-view';
import { useInsidePeekView } from '@polycanvas/core/modules/peek-view/view/modal-container';
import { WorkbenchLink } from '@polycanvas/core/modules/workbench';
import type { DocMode } from '@blockmind/polymind/model';
import type { Workspace } from '@blockmind/polymind/store';
import { LiveData, useLiveData, useService } from '@toeverything/infra';
import clsx from 'clsx';
import { nanoid } from 'nanoid';
import {
  type ComponentType,
  type MouseEvent,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';

import * as styles from './styles.css';

interface PolymindPageReferenceProps {
  pageId: string;
  params?: URLSearchParams;
  title?: string; // title alias
  className?: string;
  Icon?: ComponentType;
  onClick?: (e: MouseEvent) => void;
}

function PolymindPageReferenceInner({
  pageId,
  params,
  title,
  Icon: UserIcon,
}: PolymindPageReferenceProps) {
  const docDisplayMetaService = useService(DocDisplayMetaService);
  const docsService = useService(DocsService);

  let referenceWithMode: DocMode | null = null;
  let referenceToNode = false;
  if (params) {
    const m = params.get('mode');
    if (m && (m === 'page' || m === 'edgeless')) {
      referenceWithMode = m as DocMode;
    }
    referenceToNode = params.has('blockIds') || params.has('elementIds');
  }

  const Icon = useLiveData(
    LiveData.computed(get => {
      if (UserIcon) {
        return UserIcon;
      }
      return get(
        docDisplayMetaService.icon$(pageId, {
          mode: referenceWithMode ?? undefined,
          reference: true,
          referenceToNode,
          title,
        })
      );
    })
  );

  const notFound = !useLiveData(docsService.list.doc$(pageId));

  title = useLiveData(
    docDisplayMetaService.title$(pageId, { title, reference: true })
  );

  return (
    <span className={notFound ? styles.notFound : ''}>
      <Icon className={styles.pageReferenceIcon} />
      <span className="polymind-reference-title">{title}</span>
    </span>
  );
}

export function PolymindPageReference({
  pageId,
  params,
  title,
  className,
  Icon,
  onClick: userOnClick,
}: PolymindPageReferenceProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  const [refreshKey, setRefreshKey] = useState<string>(() => nanoid());

  const peekView = useService(PeekViewService).peekView;
  const isInPeekView = useInsidePeekView();

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      userOnClick?.(e);

      if (e.defaultPrevented) {
        return;
      }

      if (e.shiftKey && ref.current) {
        e.preventDefault();
        e.stopPropagation();
        peekView
          .open({
            element: ref.current,
          })
          .catch(console.error);
      }

      if (isInPeekView) {
        peekView.close();
      }

      // update refresh key
      setRefreshKey(nanoid());

      return;
    },
    [isInPeekView, peekView, userOnClick]
  );

  const query = useMemo(() => {
    // A block/element reference link
    let str = params?.toString() ?? '';
    if (str.length) str += '&';
    str += `refreshKey=${refreshKey}`;
    return '?' + str;
  }, [params, refreshKey]);

  return (
    <WorkbenchLink
      ref={ref}
      to={`/${pageId}${query}`}
      onClick={onClick}
      className={clsx(styles.pageReferenceLink, className)}
    >
      <PolymindPageReferenceInner
        pageId={pageId}
        params={params}
        title={title}
        Icon={Icon}
      />
    </WorkbenchLink>
  );
}

export function PolymindSharedPageReference({
  pageId,
  docCollection,
  params,
  title,
  Icon,
  onClick: userOnClick,
}: PolymindPageReferenceProps & {
  docCollection: Workspace;
}) {
  const ref = useRef<HTMLAnchorElement>(null);

  const [refreshKey, setRefreshKey] = useState<string>(() => nanoid());

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      userOnClick?.(e);

      if (e.defaultPrevented) {
        return;
      }

      // update refresh key
      setRefreshKey(nanoid());

      // Prevent blockmind link clicked behavior
      e.stopPropagation();

      return;
    },
    [userOnClick]
  );

  const query = useMemo(() => {
    // A block/element reference link
    let str = params?.toString() ?? '';
    if (str.length) str += '&';
    str += `refreshKey=${refreshKey}`;
    return '?' + str;
  }, [params, refreshKey]);

  return (
    <Link
      ref={ref}
      to={`/workspace/${docCollection.id}/${pageId}${query}`}
      onClick={onClick}
      className={styles.pageReferenceLink}
    >
      <PolymindPageReferenceInner
        pageId={pageId}
        params={params}
        title={title}
        Icon={Icon}
      />
    </Link>
  );
}
