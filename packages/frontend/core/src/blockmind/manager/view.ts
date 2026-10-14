import { DatabaseViewExtension } from '@blockmind/polymind/blocks/database/view';
import { ParagraphViewExtension } from '@blockmind/polymind/blocks/paragraph/view';
import type {
  PeekOptions,
  PeekViewService as BSPeekViewService,
} from '@blockmind/polymind/components/peek';
import { ViewExtensionManager } from '@blockmind/polymind/ext-loader';
import { getInternalViewExtensions } from '@blockmind/polymind/extensions/view';
import { FoundationViewExtension } from '@blockmind/polymind/foundation/view';
import { PolymindCanvasTextFonts } from '@blockmind/polymind/shared/services';
import { LinkedDocViewExtension } from '@blockmind/polymind/widgets/linked-doc/view';
import type { ReactToLit } from '@polycanvas/component';
import { CloudViewExtension } from '@polycanvas/core/blockmind/view-extensions/cloud';
import { CodeBlockPreviewViewExtension } from '@polycanvas/core/blockmind/view-extensions/code-block-preview';
import { PolymindDatabaseViewExtension } from '@polycanvas/core/blockmind/view-extensions/database';
import {
  EdgelessBlockHeaderConfigViewExtension,
  type EdgelessBlockHeaderViewOptions,
} from '@polycanvas/core/blockmind/view-extensions/edgeless-block-header';
import { PolymindEditorConfigViewExtension } from '@polycanvas/core/blockmind/view-extensions/editor-config';
import { createDatabaseOptionsConfig } from '@polycanvas/core/blockmind/view-extensions/editor-config/database';
import { createLinkedWidgetConfig } from '@polycanvas/core/blockmind/view-extensions/editor-config/linked';
import {
  PolymindEditorViewExtension,
  type PolymindEditorViewOptions,
} from '@polycanvas/core/blockmind/view-extensions/editor-view/editor-view';
import { ElectronViewExtension } from '@polycanvas/core/blockmind/view-extensions/electron';
import { PolymindIconPickerExtension } from '@polycanvas/core/blockmind/view-extensions/icon-picker';
import { PolymindLinkPreviewExtension } from '@polycanvas/core/blockmind/view-extensions/link-preview-service';
import { PdfViewExtension } from '@polycanvas/core/blockmind/view-extensions/pdf';
import { PolymindThemeViewExtension } from '@polycanvas/core/blockmind/view-extensions/theme';
import { TurboRendererViewExtension } from '@polycanvas/core/blockmind/view-extensions/turbo-renderer';
import { PeekViewService } from '@polycanvas/core/modules/peek-view';
import { DebugLogger } from '@polycanvas/debug';
import type { FrameworkProvider } from '@toeverything/infra';
import type { TemplateResult } from 'lit';

type Configure = {
  init: () => Configure;

  foundation: (framework?: FrameworkProvider) => Configure;
  editorView: (options?: PolymindEditorViewOptions) => Configure;
  theme: (framework?: FrameworkProvider) => Configure;
  editorConfig: (framework?: FrameworkProvider) => Configure;
  edgelessBlockHeader: (options?: EdgelessBlockHeaderViewOptions) => Configure;
  database: (framework?: FrameworkProvider) => Configure;
  linkedDoc: (framework?: FrameworkProvider) => Configure;
  paragraph: (enableAI?: boolean) => Configure;
  cloud: (framework?: FrameworkProvider, enableCloud?: boolean) => Configure;
  turboRenderer: (enableTurboRenderer?: boolean) => Configure;
  pdf: (enablePDFEmbedPreview?: boolean, reactToLit?: ReactToLit) => Configure;
  electron: (framework?: FrameworkProvider) => Configure;
  linkPreview: (framework?: FrameworkProvider) => Configure;
  codeBlockPreview: (framework?: FrameworkProvider) => Configure;
  iconPicker: (framework?: FrameworkProvider) => Configure;
  comment: (
    enableComment?: boolean,
    framework?: FrameworkProvider
  ) => Configure;

  value: ViewExtensionManager;
};

const peekViewLogger = new DebugLogger('polymind::patch-peek-view-service');

class ViewProvider {
  static instance: ViewProvider | null = null;
  static getInstance() {
    if (!ViewProvider.instance) {
      ViewProvider.instance = new ViewProvider();
    }
    return ViewProvider.instance;
  }

  private readonly _manager: ViewExtensionManager;

  constructor() {
    this._manager = new ViewExtensionManager([
      ...getInternalViewExtensions(),

      PolymindThemeViewExtension,
      PolymindEditorViewExtension,
      PolymindEditorConfigViewExtension,
      PolymindIconPickerExtension,
      CodeBlockPreviewViewExtension,
      EdgelessBlockHeaderConfigViewExtension,
      TurboRendererViewExtension,
      CloudViewExtension,
      PdfViewExtension,
      ElectronViewExtension,
      PolymindLinkPreviewExtension,
      PolymindDatabaseViewExtension,
      // CommentViewExtension — removed, single-user local app
    ]);
  }

  get value() {
    return this._manager;
  }

  get config(): Configure {
    return {
      init: this._initDefaultConfig,
      foundation: this._configureFoundation,
      editorView: this._configureEditorView,
      theme: this._configureTheme,
      editorConfig: this._configureEditorConfig,
      edgelessBlockHeader: this._configureEdgelessBlockHeader,
      database: this._configureDatabase,
      linkedDoc: this._configureLinkedDoc,
      paragraph: this._configureParagraph,
      cloud: this._configureCloud,
      turboRenderer: this._configureTurboRenderer,
      pdf: this._configurePdf,
      electron: this._configureElectron,
      linkPreview: this._configureLinkPreview,
      codeBlockPreview: this._configureCodeBlockHtmlPreview,
      iconPicker: this._configureIconPicker,
      comment: this._configureComment,
      value: this._manager,
    };
  }

  private readonly _initDefaultConfig = () => {
    this.config
      .foundation()
      .theme()
      .editorView()
      .editorConfig()
      .edgelessBlockHeader()
      .database()
      .linkedDoc()
      .paragraph()
      .cloud()
      .turboRenderer()
      .pdf()
      .electron()
      .linkPreview()
      .codeBlockPreview()
      .iconPicker()
      .comment();

    return this.config;
  };

  private readonly _configureFoundation = (framework?: FrameworkProvider) => {
    const peekViewService = framework?.get(PeekViewService);

    this._manager.configure(FoundationViewExtension, {
      fontConfig: PolymindCanvasTextFonts.map(font => ({
        ...font,
        url: environment.publicPath + 'fonts/' + font.url.split('/').pop(),
      })),
      peekView: !peekViewService
        ? undefined
        : ({
            peek: (
              element: {
                target: HTMLElement;
                docId: string;
                blockIds?: string[];
                template?: TemplateResult;
              },
              options?: PeekOptions
            ) => {
              peekViewLogger.debug('center peek', element);
              const { template, target, ...props } = element;

              return peekViewService.peekView.open(
                {
                  element: target,
                  docRef: props,
                },
                template,
                options?.abortSignal
              );
            },
          } satisfies BSPeekViewService),
    });

    return this.config;
  };

  private readonly _configureEditorView = (
    options?: PolymindEditorViewOptions
  ) => {
    this._manager.configure(PolymindEditorViewExtension, options);
    return this.config;
  };

  private readonly _configureTheme = (framework?: FrameworkProvider) => {
    this._manager.configure(PolymindThemeViewExtension, { framework });
    return this.config;
  };

  private readonly _configureEditorConfig = (framework?: FrameworkProvider) => {
    this._manager.configure(PolymindEditorConfigViewExtension, { framework });
    return this.config;
  };

  private readonly _configureEdgelessBlockHeader = (
    options?: EdgelessBlockHeaderViewOptions
  ) => {
    this._manager.configure(EdgelessBlockHeaderConfigViewExtension, options);
    return this.config;
  };

  private readonly _configureDatabase = (framework?: FrameworkProvider) => {
    if (framework) {
      this._manager.configure(
        DatabaseViewExtension,
        createDatabaseOptionsConfig(framework)
      );
    }
    return this.config;
  };

  private readonly _configureLinkedDoc = (framework?: FrameworkProvider) => {
    if (framework) {
      this._manager.configure(
        LinkedDocViewExtension,
        createLinkedWidgetConfig(framework)
      );
    }
    return this.config;
  };

  private readonly _configureParagraph = (enableAI?: boolean) => {
    if (BUILD_CONFIG.isMobileEdition) {
      this._manager.configure(ParagraphViewExtension, {
        getPlaceholder: model => {
          const placeholders = {
            text: '',
            h1: 'Heading 1',
            h2: 'Heading 2',
            h3: 'Heading 3',
            h4: 'Heading 4',
            h5: 'Heading 5',
            h6: 'Heading 6',
            quote: '',
          };
          return placeholders[model.props.type] ?? '';
        },
      });
    } else if (enableAI) {
      this._manager.configure(ParagraphViewExtension, {
        getPlaceholder: model => {
          const placeholders = {
            text: "Type '/' for commands, 'space' for AI",
            h1: 'Heading 1',
            h2: 'Heading 2',
            h3: 'Heading 3',
            h4: 'Heading 4',
            h5: 'Heading 5',
            h6: 'Heading 6',
            quote: '',
          };
          return placeholders[model.props.type] ?? '';
        },
      });
    }
    return this.config;
  };

  private readonly _configureCloud = (
    framework?: FrameworkProvider,
    enableCloud?: boolean
  ) => {
    this._manager.configure(CloudViewExtension, { framework, enableCloud });
    return this.config;
  };

  private readonly _configureTurboRenderer = (
    enableTurboRenderer?: boolean
  ) => {
    this._manager.configure(TurboRendererViewExtension, {
      enableTurboRenderer,
    });
    return this.config;
  };

  private readonly _configurePdf = (
    enablePDFEmbedPreview?: boolean,
    reactToLit?: ReactToLit
  ) => {
    this._manager.configure(PdfViewExtension, {
      enablePDFEmbedPreview,
      reactToLit,
    });
    return this.config;
  };

  private readonly _configureElectron = (framework?: FrameworkProvider) => {
    this._manager.configure(ElectronViewExtension, { framework });
    return this.config;
  };

  private readonly _configureLinkPreview = (framework?: FrameworkProvider) => {
    this._manager.configure(PolymindLinkPreviewExtension, { framework });
    return this.config;
  };

  private readonly _configureCodeBlockHtmlPreview = (
    framework?: FrameworkProvider
  ) => {
    this._manager.configure(CodeBlockPreviewViewExtension, { framework });
    return this.config;
  };

  private readonly _configureIconPicker = (framework?: FrameworkProvider) => {
    this._manager.configure(PolymindIconPickerExtension, { framework });
    return this.config;
  };

  // Comment feature removed — single-user local app
  private readonly _configureComment = () => {
    return this.config;
  };
}

export function getViewManager() {
  return ViewProvider.getInstance();
}
