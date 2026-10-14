import { EdgelessClipboardConfig } from '@blockmind/polymind-block-surface';
import { type BlockSnapshot } from '@blockmind/store';

export class EdgelessClipboardNoteConfig extends EdgelessClipboardConfig {
  static override readonly key = 'polymind:note';

  override async createBlock(note: BlockSnapshot): Promise<null | string> {
    const oldId = note.id;

    delete note.props.index;
    if (!note.props.xywh) {
      console.error(`Note block(id: ${oldId}) does not have xywh property`);
      return null;
    }

    const newId = await this.onBlockSnapshotPaste(
      note,
      this.std.store,
      this.std.store.root!.id
    );
    if (!newId) {
      console.error(`Failed to paste note block(id: ${oldId})`);
      return null;
    }

    return newId;
  }
}
