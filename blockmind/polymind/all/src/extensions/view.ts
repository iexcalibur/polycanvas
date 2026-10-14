import { AttachmentViewExtension } from '@blockmind/polymind-block-attachment/view';
import { BookmarkViewExtension } from '@blockmind/polymind-block-bookmark/view';
import { CalloutViewExtension } from '@blockmind/polymind-block-callout/view';
import { CodeBlockViewExtension } from '@blockmind/polymind-block-code/view';
import { DataViewViewExtension } from '@blockmind/polymind-block-data-view/view';
import { DatabaseViewExtension } from '@blockmind/polymind-block-database/view';
import { DividerViewExtension } from '@blockmind/polymind-block-divider/view';
import { EdgelessTextViewExtension } from '@blockmind/polymind-block-edgeless-text/view';
import { EmbedViewExtension } from '@blockmind/polymind-block-embed/view';
import { EmbedDocViewExtension } from '@blockmind/polymind-block-embed-doc/view';
import { FrameViewExtension } from '@blockmind/polymind-block-frame/view';
import { ImageViewExtension } from '@blockmind/polymind-block-image/view';
import { LatexViewExtension } from '@blockmind/polymind-block-latex/view';
import { ListViewExtension } from '@blockmind/polymind-block-list/view';
import { NoteViewExtension } from '@blockmind/polymind-block-note/view';
import { ParagraphViewExtension } from '@blockmind/polymind-block-paragraph/view';
import { RootViewExtension } from '@blockmind/polymind-block-root/view';
import { SurfaceViewExtension } from '@blockmind/polymind-block-surface/view';
import { SurfaceRefViewExtension } from '@blockmind/polymind-block-surface-ref/view';
import { TableViewExtension } from '@blockmind/polymind-block-table/view';
import { FoundationViewExtension } from '@blockmind/polymind-foundation/view';
import { AdapterPanelViewExtension } from '@blockmind/polymind-fragment-adapter-panel/view';
import { DocTitleViewExtension } from '@blockmind/polymind-fragment-doc-title/view';
import { FramePanelViewExtension } from '@blockmind/polymind-fragment-frame-panel/view';
import { OutlineViewExtension } from '@blockmind/polymind-fragment-outline/view';
import { BrushViewExtension } from '@blockmind/polymind-gfx-brush/view';
import { ConnectorViewExtension } from '@blockmind/polymind-gfx-connector/view';
import { GroupViewExtension } from '@blockmind/polymind-gfx-group/view';
import { LinkViewExtension as GfxLinkViewExtension } from '@blockmind/polymind-gfx-link/view';
import { MindmapViewExtension } from '@blockmind/polymind-gfx-mindmap/view';
import { NoteViewExtension as GfxNoteViewExtension } from '@blockmind/polymind-gfx-note/view';
import { PointerViewExtension } from '@blockmind/polymind-gfx-pointer/view';
import { ShapeViewExtension } from '@blockmind/polymind-gfx-shape/view';
import { TemplateViewExtension } from '@blockmind/polymind-gfx-template/view';
import { TextViewExtension } from '@blockmind/polymind-gfx-text/view';
import { FootnoteViewExtension } from '@blockmind/polymind-inline-footnote/view';
import { LatexViewExtension as InlineLatexViewExtension } from '@blockmind/polymind-inline-latex/view';
import { LinkViewExtension } from '@blockmind/polymind-inline-link/view';
import { MentionViewExtension } from '@blockmind/polymind-inline-mention/view';
import { InlinePresetViewExtension } from '@blockmind/polymind-inline-preset/view';
import { ReferenceViewExtension } from '@blockmind/polymind-inline-reference/view';
import { DragHandleViewExtension } from '@blockmind/polymind-widget-drag-handle/view';
import { EdgelessAutoConnectViewExtension } from '@blockmind/polymind-widget-edgeless-auto-connect/view';
import { EdgelessDraggingAreaViewExtension } from '@blockmind/polymind-widget-edgeless-dragging-area/view';
import { EdgelessSelectedRectViewExtension } from '@blockmind/polymind-widget-edgeless-selected-rect/view';
import { EdgelessToolbarViewExtension } from '@blockmind/polymind-widget-edgeless-toolbar/view';
import { EdgelessZoomToolbarViewExtension } from '@blockmind/polymind-widget-edgeless-zoom-toolbar/view';
import { FrameTitleViewExtension } from '@blockmind/polymind-widget-frame-title/view';
import { KeyboardToolbarViewExtension } from '@blockmind/polymind-widget-keyboard-toolbar/view';
import { LinkedDocViewExtension } from '@blockmind/polymind-widget-linked-doc/view';
import { NoteSlicerViewExtension } from '@blockmind/polymind-widget-note-slicer/view';
import { PageDraggingAreaViewExtension } from '@blockmind/polymind-widget-page-dragging-area/view';
import { RemoteSelectionViewExtension } from '@blockmind/polymind-widget-remote-selection/view';
import { ScrollAnchoringViewExtension } from '@blockmind/polymind-widget-scroll-anchoring/view';
import { SlashMenuViewExtension } from '@blockmind/polymind-widget-slash-menu/view';
import { ToolbarViewExtension } from '@blockmind/polymind-widget-toolbar/view';
import { ViewportOverlayViewExtension } from '@blockmind/polymind-widget-viewport-overlay/view';

export function getInternalViewExtensions() {
  return [
    FoundationViewExtension,

    // Gfx
    PointerViewExtension,
    GfxNoteViewExtension,
    BrushViewExtension,
    ShapeViewExtension,
    MindmapViewExtension,
    ConnectorViewExtension,
    GroupViewExtension,
    TextViewExtension,
    TemplateViewExtension,
    GfxLinkViewExtension,

    // Block
    AttachmentViewExtension,
    BookmarkViewExtension,
    CalloutViewExtension,
    CodeBlockViewExtension,
    DataViewViewExtension,
    DatabaseViewExtension,
    DividerViewExtension,
    EdgelessTextViewExtension,
    EmbedViewExtension,
    EmbedDocViewExtension,
    FrameViewExtension,
    ImageViewExtension,
    LatexViewExtension,
    ListViewExtension,
    NoteViewExtension,
    ParagraphViewExtension,
    SurfaceRefViewExtension,
    TableViewExtension,
    SurfaceViewExtension,
    RootViewExtension,

    // Inline
    FootnoteViewExtension,
    LinkViewExtension,
    ReferenceViewExtension,
    InlineLatexViewExtension,
    MentionViewExtension,
    InlinePresetViewExtension,

    // Widget
    // order will affect the z-index of the widget
    DragHandleViewExtension,
    EdgelessAutoConnectViewExtension,
    FrameTitleViewExtension,
    KeyboardToolbarViewExtension,
    LinkedDocViewExtension,
    RemoteSelectionViewExtension,
    ScrollAnchoringViewExtension,
    SlashMenuViewExtension,
    ToolbarViewExtension,
    ViewportOverlayViewExtension,
    EdgelessZoomToolbarViewExtension,
    PageDraggingAreaViewExtension,
    EdgelessSelectedRectViewExtension,
    EdgelessDraggingAreaViewExtension,
    NoteSlicerViewExtension,
    EdgelessToolbarViewExtension,

    // Fragment
    DocTitleViewExtension,
    FramePanelViewExtension,
    OutlineViewExtension,
    AdapterPanelViewExtension,
  ];
}
