import { AttachmentStoreExtension } from '@blockmind/polymind-block-attachment/store';
import { BookmarkStoreExtension } from '@blockmind/polymind-block-bookmark/store';
import { CalloutStoreExtension } from '@blockmind/polymind-block-callout/store';
import { CodeStoreExtension } from '@blockmind/polymind-block-code/store';
import { DataViewStoreExtension } from '@blockmind/polymind-block-data-view/store';
import { DatabaseStoreExtension } from '@blockmind/polymind-block-database/store';
import { DividerStoreExtension } from '@blockmind/polymind-block-divider/store';
import { EdgelessTextStoreExtension } from '@blockmind/polymind-block-edgeless-text/store';
import { EmbedStoreExtension } from '@blockmind/polymind-block-embed/store';
import { EmbedDocStoreExtension } from '@blockmind/polymind-block-embed-doc/store';
import { FrameStoreExtension } from '@blockmind/polymind-block-frame/store';
import { ImageStoreExtension } from '@blockmind/polymind-block-image/store';
import { LatexStoreExtension } from '@blockmind/polymind-block-latex/store';
import { ListStoreExtension } from '@blockmind/polymind-block-list/store';
import { NoteStoreExtension } from '@blockmind/polymind-block-note/store';
import { ParagraphStoreExtension } from '@blockmind/polymind-block-paragraph/store';
import { RootStoreExtension } from '@blockmind/polymind-block-root/store';
import { SurfaceStoreExtension } from '@blockmind/polymind-block-surface/store';
import { SurfaceRefStoreExtension } from '@blockmind/polymind-block-surface-ref/store';
import { TableStoreExtension } from '@blockmind/polymind-block-table/store';
import { FoundationStoreExtension } from '@blockmind/polymind-foundation/store';
import { BrushStoreExtension } from '@blockmind/polymind-gfx-brush/store';
import { ConnectorStoreExtension } from '@blockmind/polymind-gfx-connector/store';
import { GroupStoreExtension } from '@blockmind/polymind-gfx-group/store';
import { MindmapStoreExtension } from '@blockmind/polymind-gfx-mindmap/store';
import { ShapeStoreExtension } from '@blockmind/polymind-gfx-shape/store';
import { TextStoreExtension } from '@blockmind/polymind-gfx-text/store';
import { FootnoteStoreExtension } from '@blockmind/polymind-inline-footnote/store';
import { LatexStoreExtension as InlineLatexStoreExtension } from '@blockmind/polymind-inline-latex/store';
import { LinkStoreExtension } from '@blockmind/polymind-inline-link/store';
import { InlinePresetStoreExtension } from '@blockmind/polymind-inline-preset/store';
import { ReferenceStoreExtension } from '@blockmind/polymind-inline-reference/store';

export function getInternalStoreExtensions() {
  return [
    FoundationStoreExtension,

    AttachmentStoreExtension,
    BookmarkStoreExtension,
    CalloutStoreExtension,
    CodeStoreExtension,
    DataViewStoreExtension,
    DatabaseStoreExtension,
    DividerStoreExtension,
    EdgelessTextStoreExtension,
    EmbedStoreExtension,
    EmbedDocStoreExtension,
    FrameStoreExtension,
    ImageStoreExtension,
    LatexStoreExtension,
    ListStoreExtension,
    NoteStoreExtension,
    ParagraphStoreExtension,
    SurfaceRefStoreExtension,
    TableStoreExtension,
    SurfaceStoreExtension,
    RootStoreExtension,

    FootnoteStoreExtension,
    LinkStoreExtension,
    ReferenceStoreExtension,
    InlineLatexStoreExtension,
    InlinePresetStoreExtension,

    BrushStoreExtension,
    ShapeStoreExtension,
    MindmapStoreExtension,
    ConnectorStoreExtension,
    GroupStoreExtension,
    TextStoreExtension,
  ];
}
