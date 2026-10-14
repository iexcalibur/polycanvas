import type { Connectable, NoteBlockModel } from '@blockmind/polymind-model';
import type { GfxModel } from '@blockmind/std/gfx';
import type { BlockModel } from '@blockmind/store';

export function isConnectable(
  element: GfxModel | null
): element is Connectable {
  return !!element && element.connectable;
}

export function isNoteBlock(
  element: BlockModel | GfxModel | null
): element is NoteBlockModel {
  return !!element && 'flavour' in element && element.flavour === 'polymind:note';
}
