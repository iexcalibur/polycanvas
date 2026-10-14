import { type Container, createIdentifier } from '@blockmind/global/di';
import { type BlockStdScope, StdIdentifier } from '@blockmind/std';
import { Extension, Slice, type SliceSnapshot } from '@blockmind/store';

export const DndApiExtensionIdentifier = createIdentifier<DNDAPIExtension>(
  'PolymindDndApiIdentifier'
);

export class DNDAPIExtension extends Extension {
  mimeType = 'application/x-blockmind-dnd';

  constructor(readonly std: BlockStdScope) {
    super();
  }

  static override setup(di: Container) {
    di.add(this, [StdIdentifier]);

    di.addImpl(DndApiExtensionIdentifier, provider => provider.get(this));
  }

  decodeSnapshot(data: string): SliceSnapshot {
    return JSON.parse(decodeURIComponent(data));
  }

  encodeSnapshot(json: SliceSnapshot) {
    const snapshot = JSON.stringify(json);
    return encodeURIComponent(snapshot);
  }

  fromEntity(options: {
    docId: string;
    flavour?: string;
    blockId?: string;
    props?: Record<string, unknown>;
  }): SliceSnapshot | null {
    const { docId, flavour = 'polymind:embed-linked-doc', blockId } = options;

    const slice = Slice.fromModels(this.std.store, []);
    const job = this.std.store.getTransformer();
    const snapshot = job.sliceToSnapshot(slice);
    if (!snapshot) {
      console.error('Failed to convert slice to snapshot');
      return null;
    }
    const props = {
      ...options.props,
      ...(blockId ? { blockId } : {}),
      pageId: docId,
      style: flavour === 'polymind:embed-synced-doc' ? 'syncedDoc' : 'vertical',
    };
    return {
      ...snapshot,
      content: [
        {
          id: this.std.workspace.idGenerator(),
          type: 'block',
          flavour,
          props,
          children: [],
        },
      ],
    };
  }
}
