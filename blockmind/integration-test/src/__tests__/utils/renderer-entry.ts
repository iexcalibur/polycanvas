import { ImageLayoutHandlerExtension } from '@blockmind/polymind/blocks/image';
import { ListLayoutHandlerExtension } from '@blockmind/polymind/blocks/list';
import { ParagraphLayoutHandlerExtension } from '@blockmind/polymind/blocks/paragraph';
import {
  TurboRendererConfigFactory,
  ViewportTurboRendererExtension,
  ViewportTurboRendererIdentifier,
} from '@blockmind/polymind/gfx/turbo-renderer';

import { addSampleNotes } from './doc-generator.js';
import { createPainterWorker, setupEditor } from './setup.js';

async function init() {
  await setupEditor('edgeless', [
    ParagraphLayoutHandlerExtension,
    ListLayoutHandlerExtension,
    ImageLayoutHandlerExtension,
    TurboRendererConfigFactory({
      painterWorkerEntry: createPainterWorker,
    }),
    ViewportTurboRendererExtension,
  ]);
  addSampleNotes(doc, 100);
  doc.load();

  const renderer = editor.std.get(
    ViewportTurboRendererIdentifier
  ) as ViewportTurboRendererExtension;
  window.renderer = renderer;
}

await init();
