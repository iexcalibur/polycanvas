import { CodeLayoutPainterExtension } from '@blockmind/polymind/blocks/code';
import { ImageLayoutPainterExtension } from '@blockmind/polymind/blocks/image';
import { ListLayoutPainterExtension } from '@blockmind/polymind/blocks/list';
import { NoteLayoutPainterExtension } from '@blockmind/polymind/blocks/note';
import { ParagraphLayoutPainterExtension } from '@blockmind/polymind/blocks/paragraph';
import { ViewportLayoutPainter } from '@blockmind/polymind/gfx/turbo-renderer';

new ViewportLayoutPainter([
  ParagraphLayoutPainterExtension,
  ListLayoutPainterExtension,
  NoteLayoutPainterExtension,
  CodeLayoutPainterExtension,
  ImageLayoutPainterExtension,
]);
