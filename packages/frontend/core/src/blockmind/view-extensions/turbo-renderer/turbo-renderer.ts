import { getWorkerUrl } from '@polycanvas/env/worker';
import { CodeLayoutHandlerExtension } from '@blockmind/polymind/blocks/code';
import { ImageLayoutHandlerExtension } from '@blockmind/polymind/blocks/image';
import { ListLayoutHandlerExtension } from '@blockmind/polymind/blocks/list';
import { NoteLayoutHandlerExtension } from '@blockmind/polymind/blocks/note';
import { ParagraphLayoutHandlerExtension } from '@blockmind/polymind/blocks/paragraph';
import {
  TurboRendererConfigFactory,
  ViewportTurboRendererExtension,
} from '@blockmind/polymind/gfx/turbo-renderer';

function createPainterWorker() {
  const worker = new Worker(getWorkerUrl('turbo-painter'));
  return worker;
}

export const turboRendererExtension = [
  ParagraphLayoutHandlerExtension,
  ListLayoutHandlerExtension,
  NoteLayoutHandlerExtension,
  CodeLayoutHandlerExtension,
  ImageLayoutHandlerExtension,
  TurboRendererConfigFactory({
    options: {
      zoomThreshold: 1,
      debounceTime: 1000,
    },
    painterWorkerEntry: createPainterWorker,
  }),
  ViewportTurboRendererExtension,
];
