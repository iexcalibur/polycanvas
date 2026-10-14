import { I18n } from '@polycanvas/i18n';
import type { DocMode } from '@blockmind/polymind/model';
import type { PolymindInlineEditor } from '@blockmind/polymind/shared/types';
import {
  type EditorHost,
} from '@blockmind/polymind/std';
import type { DocMeta } from '@blockmind/polymind/store';
import {
  type LinkedMenuGroup,
  type LinkedMenuItem,
  type LinkedWidgetConfig,
  LinkedWidgetUtils,
} from '@blockmind/polymind/widgets/linked-doc';
import {
  NewXxxEdgelessIcon,
  NewXxxPageIcon,
  UserIcon,
} from '@blocksuite/icons/lit';
import { computed, Signal } from '@preact/signals-core';
import { Service } from '@toeverything/infra';
import { cssVarV2 } from '@polycanvas/theme/v2';
import type { FuseResultMatch } from 'fuse.js';
import Fuse from 'fuse.js';
import { html } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';

import type { WorkspaceDialogService } from '../../dialogs';
import type { DocsService } from '../../doc';
import type { GuardService, MemberSearchService } from '../../permissions';
import type { DocGrantedUsersService } from '../../permissions/services/doc-granted-users';
import { highlighter } from '../../quicksearch/utils/highlighter';
import type { SearchMenuService } from '../../search-menu/services';

function resolveSignal<T>(data: T | Signal<T>): T {
  return data instanceof Signal ? data.value : data;
}

const RESERVED_ITEM_KEYS = {
  createPage: 'create:page',
  createEdgeless: 'create:edgeless',
  datePicker: 'date-picker',
};

export class AtMenuConfigService extends Service {
  constructor(
    private readonly dialogService: WorkspaceDialogService,
    private readonly docsService: DocsService,
    private readonly searchMenuService: SearchMenuService,
    private readonly memberSearchService: MemberSearchService,
    private readonly guardService: GuardService,
    private readonly docGrantedUsersService: DocGrantedUsersService
  ) {
    super();
  }

  // todo(@peng17): maybe refactor the config using entity, so that each config
  // can be reactive to the query, instead of recreating the whole config?
  getConfig(): Partial<LinkedWidgetConfig> {
    return {
      getMenus: this.getMenusFn(),
      mobile: this.getMobileConfig(),
      autoFocusedItemKey: this.autoFocusedItemKey,
    };
  }

  private insertDoc(inlineEditor: PolymindInlineEditor, id: string) {
    LinkedWidgetUtils.insertLinkedNode({
      inlineEditor,
      docId: id,
    });
  }

  private readonly autoFocusedItemKey = (
    menus: LinkedMenuGroup[],
    query: string
  ): string | null => {
    if (query.trim().length === 0) {
      return null;
    }

    const linkToDocGroup = menus[0];
    const memberGroup = menus[1];

    if (resolveSignal(memberGroup.items).length > 1) {
      return resolveSignal(memberGroup.items)[0]?.key;
    }

    if (resolveSignal(linkToDocGroup.items).length > 0) {
      return resolveSignal(linkToDocGroup.items)[0]?.key;
    }

    return RESERVED_ITEM_KEYS.createPage;
  };

  private newDocMenuGroup(
    query: string,
    close: () => void,
    editorHost: EditorHost,
    inlineEditor: PolymindInlineEditor
  ): LinkedMenuGroup {
    const originalNewDocMenuGroup = LinkedWidgetUtils.createNewDocMenuGroup(
      query,
      close,
      editorHost,
      inlineEditor
    );

    // Patch the import item, to use the custom import dialog.
    const items = Array.isArray(originalNewDocMenuGroup.items)
      ? originalNewDocMenuGroup.items
      : originalNewDocMenuGroup.items.value;

    const importItem = items.find(item => item.key === 'import');

    if (!importItem) {
      return originalNewDocMenuGroup;
    }

    const createPage = (mode: DocMode) => {
      const page = this.docsService.createDoc({
        title: query,
        primaryMode: mode,
      });

      return page;
    };

    const customNewDocItems: LinkedMenuItem[] = [
      {
        key: RESERVED_ITEM_KEYS.createPage,
        icon: NewXxxPageIcon(),
        name: I18n.t('com.polymind.editor.at-menu.create-page', {
          name: query || I18n.t('Untitled'),
        }),
        action: () => {
          close();
          const page = createPage('page');
          this.insertDoc(inlineEditor, page.id);
        },
      },
      {
        key: RESERVED_ITEM_KEYS.createEdgeless,
        icon: NewXxxEdgelessIcon(),
        name: I18n.t('com.polymind.editor.at-menu.create-edgeless', {
          name: query || I18n.t('Untitled'),
        }),
        action: () => {
          close();
          const page = createPage('edgeless');
          this.insertDoc(inlineEditor, page.id);
        },
      },
    ];
    const customImportItem: LinkedMenuItem = {
      ...importItem,
      name: I18n.t('com.polymind.editor.at-menu.import'),
      action: () => {
        close();
        this.dialogService.open('import', undefined, payload => {
          if (!payload) {
            return;
          }

          // If the imported file is a workspace file, insert the entry page node.
          const { docIds, entryId, isWorkspaceFile } = payload;
          if (isWorkspaceFile && entryId) {
            this.insertDoc(inlineEditor, entryId);
            return;
          }

          // Otherwise, insert all the doc nodes.
          for (const docId of docIds) {
            this.insertDoc(inlineEditor, docId);
          }
        });
      },
    };

    return {
      ...originalNewDocMenuGroup,
      name: I18n.t('com.polymind.editor.at-menu.new-doc'),
      items: [...customNewDocItems, customImportItem],
    };
  }

  private linkToDocGroup(
    query: string,
    close: () => void,
    inlineEditor: PolymindInlineEditor,
    abortSignal: AbortSignal
  ): LinkedMenuGroup {
    const action = (meta: DocMeta) => {
      close();
      this.insertDoc(inlineEditor, meta.id);
    };
    const result = this.searchMenuService.getDocMenuGroup(
      query,
      action,
      abortSignal
    );
    return result;
  }

  private highlightFuseTitle(
    matches: readonly FuseResultMatch[] | undefined,
    title: string,
    key: string
  ): string {
    if (!matches) {
      return title;
    }
    const normalizedRange = ([start, end]: [number, number]) =>
      [
        start,
        end + 1 /* in fuse, the `end` is different from the `substring` */,
      ] as [number, number];
    const titleMatches = matches
      ?.filter(match => match.key === key)
      .flatMap(match => match.indices.map(normalizedRange));
    return (
      highlighter(
        title,
        `<span style="color: ${cssVarV2('text/emphasis')}">`,
        '</span>',
        titleMatches ?? []
      ) ?? title
    );
  }

  private memberGroup(
    query: string,
    close: () => void,
    inlineEditor: PolymindInlineEditor,
    _: AbortSignal
  ): LinkedMenuGroup {
    const getMenuItem = (
      id: string,
      name?: string | null,
      avatar?: string | null,
      sendNotification: boolean = true
    ): LinkedMenuItem => {
      const avatarStyle = styleMap({
        borderRadius: '50%',
        border: `1px solid ${cssVarV2('layer/background/overlayPanel')}`,
        width: '20px',
        height: '20px',
        boxSizing: 'border-box',
      });
      const icon = avatar
        ? html`<img style=${avatarStyle} src="${avatar}" />`
        : UserIcon();

      let displayName = name ?? 'Unknown';
      return {
        key: id,
        name: html`${unsafeHTML(displayName)}`,
        icon,
        action: () => {
          close();

          const inlineRange = inlineEditor.getInlineRange();
          if (!inlineRange || inlineRange.length !== 0) return;

          inlineEditor.insertText(inlineRange, ' ', {
            mention: {
              member: id,
            },
          });
          inlineEditor.setInlineRange({
            index: inlineRange.index + 1,
            length: 0,
          });

        },
      };
    };

    const inviteItem: LinkedMenuItem = {
      key: 'invite',
      name: 'Invite...',
      icon: UserIcon(),
      action: () => {
        close();

        this.dialogService.open('setting', {
          activeTab: 'workspace:members',
        });
      },
    };

    const items = computed<LinkedMenuItem[]>(() => {
      const members = this.memberSearchService.result$.signal.value;
      const currentUser = null;
      const canUserManage = this.guardService.can$('Workspace_Users_Manage')
        .signal.value;

      if (query.length === 0) {
        return [
          ...(currentUser
            ? [
                getMenuItem(
                  currentUser.id,
                  currentUser.info?.name,
                  currentUser.info?.avatarUrl,
                  false
                ),
              ]
            : []),
          ...members
            .slice(0, 2)
            .filter(member => member.id !== currentUser?.id)
            .map(member =>
              getMenuItem(member.id, member.name, member.avatarUrl)
            ),
          ...(canUserManage ? [inviteItem] : []),
        ];
      }

      // Create a single Fuse instance for all members
      const fuse = new Fuse(members, {
        keys: ['name'],
        includeMatches: true,
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.0,
      });
      const searchResults = fuse.search(query);

      return [
        ...searchResults.map(result => {
          const member = result.item;
          const displayName = this.highlightFuseTitle(
            result.matches,
            member.name ?? 'Unknown',
            'name'
          );
          return {
            ...getMenuItem(
              member.id,
              member.name,
              member.avatarUrl,
              member.id !== currentUser?.id
            ),
            name: html`${unsafeHTML(displayName)}`,
          };
        }),
        ...(canUserManage ? [inviteItem] : []),
      ];
    });
    const hidden = computed(() => {
      const members = this.memberSearchService.result$.signal.value;
      const loading = this.memberSearchService.isLoading$.signal.value;
      return query.length > 0 && !loading && members.length === 0;
    });

    if (query.length > 0) {
      this.memberSearchService.search(query);
    }

    return {
      name: I18n.t('com.polymind.editor.at-menu.mention-members'),
      items,
      loading: this.memberSearchService.isLoading$.signal,
      hidden,
      maxDisplay: 3,
      overflowText: computed(() => {
        const totalCount = this.memberSearchService.result$.signal.value.length;
        const remainingCount = totalCount - 3;
        return I18n.t('com.polymind.editor.at-menu.more-members-hint', {
          count: remainingCount,
        });
      }),
    };
  }

  private getMenusFn(): LinkedWidgetConfig['getMenus'] {
    return (query, close, editorHost, inlineEditor, abortSignal) => {
      return [
        this.linkToDocGroup(query, close, inlineEditor, abortSignal),
        this.memberGroup(query, close, inlineEditor, abortSignal),
        this.newDocMenuGroup(query, close, editorHost, inlineEditor),
      ];
    };
  }

  private getMobileConfig(): Partial<LinkedWidgetConfig['mobile']> {
    return {
      scrollContainer: window,
      scrollTopOffset: () => {
        const header = document.querySelector('header');
        if (!header) return 0;

        const { y, height } = header.getBoundingClientRect();
        return y + height;
      },
    };
  }
}
