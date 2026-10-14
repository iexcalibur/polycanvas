import {
  ImportIcon,
  LinkedDocIcon,
  LinkedEdgelessIcon,
  NewDocIcon,
} from '@blockmind/polymind-components/icons';
import { toast } from '@blockmind/polymind-components/toast';
import { StoreExtensionManagerIdentifier } from '@blockmind/polymind-ext-loader';
import { insertLinkedNode } from '@blockmind/polymind-inline-reference';
import { DocModeProvider } from '@blockmind/polymind-shared/services';
import type { PolymindInlineEditor } from '@blockmind/polymind-shared/types';
import {
  createDefaultDoc,
  isFuzzyMatch,
  type Signal,
} from '@blockmind/polymind-shared/utils';
import { IS_MOBILE } from '@blockmind/global/env';
import {
  type BlockStdScope,
  ConfigExtensionFactory,
  type EditorHost,
} from '@blockmind/std';
import type { InlineRange } from '@blockmind/std/inline';
import type { TemplateResult } from 'lit';

import { showImportModal } from './import-doc/index.js';
import type { LinkedDocViewExtensionOptions } from './view';

export type LinkedWidgetConfig = Required<
  Omit<LinkedDocViewExtensionOptions, 'autoFocusedItemKey'>
> &
  Pick<LinkedDocViewExtensionOptions, 'autoFocusedItemKey'>;

export type LinkedMenuItem = {
  key: string;
  name: string | TemplateResult<1>;
  icon: TemplateResult<1>;
  suffix?: string | TemplateResult<1>;
  // disabled?: boolean;
  action: LinkedMenuAction;
};

export type LinkedMenuAction = () => Promise<void> | void;

export type LinkedMenuGroup = {
  name: string;
  items: LinkedMenuItem[] | Signal<LinkedMenuItem[]>;
  styles?: string;
  // maximum quantity displayed by default
  maxDisplay?: number;
  // if the menu is loading
  loading?: boolean | Signal<boolean>;
  // copywriting when display quantity exceeds
  overflowText?: string | Signal<string>;
  // hide the group
  hidden?: boolean | Signal<boolean>;
};

export type LinkedDocContext = {
  std: BlockStdScope;
  inlineEditor: PolymindInlineEditor;
  startRange: InlineRange;
  startNativeRange: Range;
  triggerKey: string;
  config: LinkedWidgetConfig;
  close: () => void;
};

const DEFAULT_DOC_NAME = 'Untitled';
const DISPLAY_NAME_LENGTH = 8;

export function createLinkedDocMenuGroup(
  query: string,
  abort: () => void,
  editorHost: EditorHost,
  inlineEditor: PolymindInlineEditor
) {
  const doc = editorHost.store;
  const { docMetas } = doc.workspace.meta;
  const filteredDocList = docMetas
    .filter(({ id }) => id !== doc.id)
    .filter(({ title }) => isFuzzyMatch(title, query));
  const MAX_DOCS = 6;

  return {
    name: 'Link to Doc',
    items: filteredDocList.map(doc => ({
      key: doc.id,
      name: doc.title || DEFAULT_DOC_NAME,
      icon:
        editorHost.std.get(DocModeProvider).getPrimaryMode(doc.id) ===
        'edgeless'
          ? LinkedEdgelessIcon
          : LinkedDocIcon,
      action: () => {
        abort();
        insertLinkedNode({
          inlineEditor,
          docId: doc.id,
        });
        editorHost.std?.track('LinkedDocCreated', {
          control: 'linked doc',
          module: 'inline @',
          type: 'doc',
          other: 'existing doc',
        });
      },
    })),
    maxDisplay: MAX_DOCS,
    overflowText: `${filteredDocList.length - MAX_DOCS} more docs`,
  };
}

export function createNewDocMenuGroup(
  query: string,
  abort: () => void,
  editorHost: EditorHost,
  inlineEditor: PolymindInlineEditor
): LinkedMenuGroup {
  const doc = editorHost.store;
  const docName = query || DEFAULT_DOC_NAME;
  const displayDocName =
    docName.slice(0, DISPLAY_NAME_LENGTH) +
    (docName.length > DISPLAY_NAME_LENGTH ? '..' : '');

  const items: LinkedMenuItem[] = [
    {
      key: 'create',
      name: `Create "${displayDocName}" doc`,
      icon: NewDocIcon,
      action: () => {
        abort();
        const docName = query;
        const newDoc = createDefaultDoc(doc.workspace, {
          title: docName,
        });
        insertLinkedNode({
          inlineEditor,
          docId: newDoc.id,
        });
      },
    },
  ];

  if (!IS_MOBILE) {
    items.push({
      key: 'import',
      name: 'Import',
      icon: ImportIcon,
      action: () => {
        abort();
        const onSuccess = (
          docIds: string[],
          options: {
            importedCount: number;
          }
        ) => {
          toast(
            editorHost,
            `Successfully imported ${options.importedCount} Doc${options.importedCount > 1 ? 's' : ''}.`
          );
          for (const docId of docIds) {
            insertLinkedNode({
              inlineEditor,
              docId,
            });
          }
        };
        const onFail = (message: string) => {
          toast(editorHost, message);
        };
        const storeManager = editorHost.std.get(
          StoreExtensionManagerIdentifier
        );
        showImportModal({
          collection: doc.workspace,
          schema: doc.schema,
          extensions: storeManager.get('store'),
          onSuccess,
          onFail,
        });
      },
    });
  }

  return {
    name: 'New Doc',
    items,
  };
}

export function getMenus(
  query: string,
  abort: () => void,
  editorHost: EditorHost,
  inlineEditor: PolymindInlineEditor
): Promise<LinkedMenuGroup[]> {
  return Promise.resolve([
    createLinkedDocMenuGroup(query, abort, editorHost, inlineEditor),
    createNewDocMenuGroup(query, abort, editorHost, inlineEditor),
  ]);
}

export const LinkedWidgetUtils = {
  createNewDocMenuGroup,
  insertLinkedNode,
};

export const POLYMIND_LINKED_DOC_WIDGET = 'polymind-linked-doc-widget';

export const LinkedWidgetConfigExtension = ConfigExtensionFactory<
  Partial<LinkedWidgetConfig>
>('polymind:widget-linked-doc');
