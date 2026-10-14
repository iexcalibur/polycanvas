import { ImageLayoutPainterExtension } from '@blockmind/polymind-block-image/turbo-painter';
import { ListLayoutPainterExtension } from '@blockmind/polymind-block-list/turbo-painter';
import { NoteLayoutPainterExtension } from '@blockmind/polymind-block-note/turbo-painter';
import { ParagraphLayoutPainterExtension } from '@blockmind/polymind-block-paragraph/turbo-painter';
import { ViewportLayoutPainter } from '@blockmind/polymind-gfx-turbo-renderer/painter';

new ViewportLayoutPainter([
  ParagraphLayoutPainterExtension,
  ListLayoutPainterExtension,
  NoteLayoutPainterExtension,
  ImageLayoutPainterExtension,
]);
