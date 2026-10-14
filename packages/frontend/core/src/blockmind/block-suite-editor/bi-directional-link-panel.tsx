import {
  Button,
  Divider,
  observeIntersection,
  Skeleton,
  useLitPortalFactory,
} from '@polycanvas/component';
import { getViewManager } from '@polycanvas/core/blockmind/manager/view';
import {
  patchReferenceRenderer,
  type ReferenceReactRenderer,
} from '@polycanvas/core/blockmind/view-extensions/editor-view/reference-renderer';
import { useGuard } from '@polycanvas/core/components/guard';
import { DocService } from '@polycanvas/core/modules/doc';
import {
  type Backlink,
  DocLinksService,
  type Link,
} from '@polycanvas/core/modules/doc-link';
import { toDocSearchParams } from '@polycanvas/core/modules/navigation/utils';
import { GlobalSessionStateService } from '@polycanvas/core/modules/storage';
import { WorkbenchLink } from '@polycanvas/core/modules/workbench';
import { WorkspaceService } from '@polycanvas/core/modules/workspace';
import { useI18n } from '@polycanvas/i18n';
import { ToggleDownIcon } from '@blocksuite/icons/rc';
import * as Collapsible from '@radix-ui/react-collapsible';
import {
  LiveData,
  useFramework,
  useLiveData,
  useServices,
} from '@toeverything/infra';
import { debounce } from 'lodash-es';
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  PolymindPageReference,
  PolymindSharedPageReference,
} from '../../components/polymind/reference-link';
import * as styles from './bi-directional-link-panel.css';

const PREFIX = 'bi-directional-link-panel-collapse:';

type BacklinkGroups = {
  docId: string;
  title: string;
  links: Backlink[];
};

const useBiDirectionalLinkPanelCollapseState = (
  docId: string,
  linkDocId?: string
) => {
  const { globalSessionStateService } = useServices({
    GlobalSessionStateService,
  });

  const path = linkDocId ? docId + ':' + linkDocId : docId;

  const [open, setOpen] = useState(
    globalSessionStateService.globalSessionState.get(PREFIX + path) ?? false
  );

  const wrappedSetOpen = useCallback(
    (open: boolean) => {
      setOpen(open);
      globalSessionStateService.globalSessionState.set(PREFIX + path, open);
    },
    [path, globalSessionStateService]
  );

  return [open, wrappedSetOpen] as const;
};

const CollapsibleSection = ({
  title,
  children,
  length,
  docId,
  linkDocId,
}: {
  title: ReactNode;
  children: ReactNode;
  length?: number;
  docId: string;
  linkDocId?: string;
}) => {
  const [open, setOpen] = useBiDirectionalLinkPanelCollapseState(
    docId,
    linkDocId
  );

  const handleToggle = useCallback(() => {
    setOpen(!open);
  }, [open, setOpen]);

  return (
    <Collapsible.Root open={open} onOpenChange={handleToggle}>
      <Collapsible.Trigger className={styles.link}>
        {title}
        {length ? (
          <ToggleDownIcon
            className={styles.collapsedIcon}
            data-collapsed={!open}
          />
        ) : null}
      </Collapsible.Trigger>
      <Collapsible.Content>{children}</Collapsible.Content>
    </Collapsible.Root>
  );
};

const usePreviewExtensions = () => {
  const [reactToLit, portals] = useLitPortalFactory();
  const framework = useFramework();

  const { workspaceService } = useServices({
    WorkspaceService,
  });

  const referenceRenderer: ReferenceReactRenderer = useMemo(() => {
    return function customReference(reference) {
      const data = reference.delta.attributes?.reference;
      if (!data) return <span />;

      const pageId = data.pageId;
      if (!pageId) return <span />;

      const params = toDocSearchParams(data.params);

      if (workspaceService.workspace.openOptions.isSharedMode) {
        return (
          <PolymindSharedPageReference
            docCollection={workspaceService.workspace.docCollection}
            pageId={pageId}
            params={params}
          />
        );
      }

      return <PolymindPageReference pageId={pageId} params={params} />;
    };
  }, [workspaceService]);

  const extensions = useMemo(() => {
    const manager = getViewManager()
      .config.init()
      .foundation(framework)
      .theme(framework)
      .database(framework)
      .iconPicker(framework)
      .linkedDoc(framework)
      .paragraph()
      .linkPreview(framework)
      .codeBlockPreview(framework).value;
    const specs = manager.get('preview-page');
    return [...specs, patchReferenceRenderer(reactToLit, referenceRenderer)];
  }, [reactToLit, referenceRenderer, framework]);

  return [extensions, portals] as const;
};

export const BacklinkGroups = () => {
  const [, portals] = usePreviewExtensions();
  const { docService } = useServices({
    DocService,
  });

  const { docLinksService } = useServices({
    DocLinksService,
  });

  const backlinkGroups = useLiveData(
    docLinksService.backlinks.backlinks$.map(links => {
      if (links === undefined) {
        return undefined;
      }

      // group by docId
      const groupedLinks = links.reduce(
        (acc, link) => {
          acc[link.docId] = [...(acc[link.docId] || []), link];
          return acc;
        },
        {} as Record<string, Backlink[]>
      );

      return Object.entries(groupedLinks).map(([docId, links]) => ({
        docId,
        title: links[0].title, // title should be the same for all blocks
        links,
      }));
    })
  );

  useEffect(() => {
    docLinksService.backlinks.revalidateFromCloud();
  }, [docLinksService]);

  return (
    <>
      {backlinkGroups === undefined ? (
        <Skeleton />
      ) : (
        backlinkGroups.map(linkGroup => (
          <CollapsibleSection
            key={linkGroup.docId}
            title={
              <PolymindPageReference
                pageId={linkGroup.docId}
                onClick={() => {}}
              />
            }
            length={linkGroup.links.length}
            docId={docService.doc.id}
            linkDocId={linkGroup.docId}
          >
            <LinkPreview linkGroup={linkGroup} />
          </CollapsibleSection>
        ))
      )}
      {portals.map(p => (
        <Fragment key={p.id}>{p.portal}</Fragment>
      ))}
    </>
  );
};

const BacklinkLinks = () => {
  const t = useI18n();

  const [visibility, setVisibility] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    return observeIntersection(
      container,
      debounce(
        entry => {
          setVisibility(entry.isIntersecting);
        },
        500,
        {
          trailing: true,
        }
      )
    );
  }, []);

  const { docLinksService } = useServices({
    DocLinksService,
  });

  const backlinks = useLiveData(docLinksService.backlinks.backlinks$);

  useEffect(() => {
    if (visibility) {
      docLinksService.backlinks.revalidateFromCloud();
    }
  }, [docLinksService, visibility]);

  const backlinkCount = backlinks?.length;

  return (
    <div className={styles.linksContainer} ref={containerRef}>
      <div className={styles.linksTitles}>
        {t['com.polymind.page-properties.backlinks']()}{' '}
        {backlinkCount !== undefined ? `· ${backlinkCount}` : ''}
      </div>
      <BacklinkGroups />
    </div>
  );
};

export const LinkPreview = ({ linkGroup }: { linkGroup: BacklinkGroups }) => {
  const canAccess = useGuard('Doc_Read', linkGroup.docId);
  const t = useI18n();

  if (!canAccess) {
    return (
      <span className={styles.notFound}>
        {t['com.polymind.share-menu.option.permission.no-access']()}
      </span>
    );
  }
  return (
    <div className={styles.linkPreviewContainer}>
      {linkGroup.links.map(link => {
        if (!link.markdownPreview) {
          return null;
        }
        const searchParams = new URLSearchParams();
        const displayMode = link.displayMode || 'page';
        searchParams.set('mode', displayMode);

        let blockId = link.blockId;
        if (link.parentFlavour === 'polymind:database' && link.parentBlockId) {
          // if parentBlockFlavour is 'polymind:database',
          // we will fallback to the database block instead
          blockId = link.parentBlockId;
        } else if (displayMode === 'edgeless' && link.noteBlockId) {
          // if note has displayMode === 'edgeless' && has noteBlockId,
          // set noteBlockId as blockId
          blockId = link.noteBlockId;
        }

        searchParams.set('blockIds', blockId);

        const to = {
          pathname: '/' + linkGroup.docId,
          search: '?' + searchParams.toString(),
          hash: '',
        };

        // if this backlink has no noteBlock && displayMode is edgeless, we will render
        // the link as a page link
        const edgelessLink = displayMode === 'edgeless' && !link.noteBlockId;

        return (
          <WorkbenchLink
            to={to}
            key={link.blockId}
            className={styles.linkPreview}
            onClick={() => {}}
          >
            {edgelessLink ? (
              <>
                [Edgeless]
                <PolymindPageReference
                  key={link.blockId}
                  pageId={linkGroup.docId}
                  params={searchParams}
                />
              </>
            ) : (
              // Plain-text preview; the rich markdown renderer lived in the
              // removed AI package.
              <div className={styles.linkPreviewRenderer}>
                {link.markdownPreview}
              </div>
            )}
          </WorkbenchLink>
        );
      })}
    </div>
  );
};

export const BiDirectionalLinkPanel = () => {
  const { docLinksService, docService } = useServices({
    DocLinksService,
    DocService,
  });

  const t = useI18n();

  const [show, setShow] = useBiDirectionalLinkPanelCollapseState(
    docService.doc.id
  );

  const links = useLiveData(
    show ? docLinksService.links.links$ : new LiveData([] as Link[])
  );

  const handleClickShow = useCallback(() => {
    setShow(!show);
  }, [show, setShow]);

  return (
    <div className={styles.container}>
      {!show && <Divider size="thinner" />}

      <div className={styles.titleLine}>
        <div className={styles.title}>Bi-Directional Links</div>
        <Button className={styles.showButton} onClick={handleClickShow}>
          {show
            ? t['com.polymind.editor.bi-directional-link-panel.hide']()
            : t['com.polymind.editor.bi-directional-link-panel.show']()}
        </Button>
      </div>

      {show && (
        <>
          <Divider size="thinner" />

          <BacklinkLinks />
          <div className={styles.linksContainer}>
            <div className={styles.linksTitles}>
              {t['com.polymind.page-properties.outgoing-links']()} ·{' '}
              {links.length}
            </div>
            {links.map((link, i) => (
              <div
                key={`${link.docId}-${link.params?.toString()}-${i}`}
                className={styles.link}
              >
                <PolymindPageReference pageId={link.docId} params={link.params} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
