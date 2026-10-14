import type {
  EdgelessRootBlockComponent,
  PageRootBlockComponent,
} from '@blockmind/polymind/blocks/root';
import type { SurfaceBlockComponent } from '@blockmind/polymind/blocks/surface';
import type { Store } from '@blockmind/store';

import type { TestPolymindEditorContainer } from '../../index.js';

export function getSurface(doc: Store, editor: TestPolymindEditorContainer) {
  const surfaceModel = doc.getModelsByFlavour('polymind:surface');

  return editor.host!.view.getBlock(
    surfaceModel[0]!.id
  ) as SurfaceBlockComponent;
}

export function getDocRootBlock(
  doc: Store,
  editor: TestPolymindEditorContainer,
  mode: 'page'
): PageRootBlockComponent;
export function getDocRootBlock(
  doc: Store,
  editor: TestPolymindEditorContainer,
  mode: 'edgeless'
): EdgelessRootBlockComponent;
export function getDocRootBlock(
  doc: Store,
  editor: TestPolymindEditorContainer,
  _?: 'edgeless' | 'page'
) {
  return editor.host!.view.getBlock(doc.root!.id) as
    | EdgelessRootBlockComponent
    | PageRootBlockComponent;
}

export function addNote(doc: Store, props: Record<string, any> = {}) {
  const noteId = doc.addBlock(
    'polymind:note',
    {
      xywh: '[0, 0, 800, 100]',
      ...props,
    },
    doc.root
  );

  doc.addBlock('polymind:paragraph', {}, noteId);

  return noteId;
}
