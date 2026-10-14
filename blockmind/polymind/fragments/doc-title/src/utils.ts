import type { EditorHost } from '@blockmind/std';

import type { DocTitle } from './doc-title';

export function getDocTitleByEditorHost(
  editorHost: EditorHost
): DocTitle | null {
  const docViewport = editorHost.closest('.polymind-page-viewport');
  if (!docViewport) return null;
  return docViewport.querySelector('doc-title');
}
