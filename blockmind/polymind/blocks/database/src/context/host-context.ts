import { createIdentifier } from '@blockmind/global/di';
import type { EditorHost } from '@blockmind/std';

export const EditorHostKey = createIdentifier<EditorHost>('editor-host');
