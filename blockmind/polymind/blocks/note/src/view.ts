import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blockmind/polymind-ext-loader';
import { NoteBlockSchema } from '@blockmind/polymind-model';
import { BlockViewExtension, FlavourExtension } from '@blockmind/std';
import { literal } from 'lit/static-html.js';

import { NoteSlashMenuConfigExtension } from './configs/slash-menu';
import { createBuiltinToolbarConfigExtension } from './configs/toolbar';
import { EdgelessClipboardNoteConfig } from './edgeless-clipboard-config';
import { effects } from './effects';
import { EdgelessNoteInteraction } from './note-edgeless-block';
import { NoteKeymapExtension } from './note-keymap';

const flavour = NoteBlockSchema.model.flavour;

export class NoteViewExtension extends ViewExtensionProvider {
  override name = 'polymind-note-block';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register([
      FlavourExtension(flavour),
      NoteSlashMenuConfigExtension,
      NoteKeymapExtension,
    ]);

    const isEdgeless = this.isEdgeless(context.scope);

    if (isEdgeless) {
      context.register(
        BlockViewExtension(flavour, literal`polymind-edgeless-note`)
      );
      context.register(createBuiltinToolbarConfigExtension(flavour));
      context.register(EdgelessClipboardNoteConfig);
      context.register(EdgelessNoteInteraction);
    } else {
      context.register(BlockViewExtension(flavour, literal`polymind-note`));
    }
  }
}
