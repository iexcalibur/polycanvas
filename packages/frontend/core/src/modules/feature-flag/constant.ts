import type { FlagInfo } from './types';

// const isNotStableBuild = BUILD_CONFIG.appBuildType !== 'stable';
const isCanaryBuild = BUILD_CONFIG.appBuildType === 'canary';
const isMobile = BUILD_CONFIG.isMobileEdition;
const isIOS = BUILD_CONFIG.isIOS;
const isAndroid = BUILD_CONFIG.isAndroid;

export const POLYMIND_FLAGS = {
  enable_ai: {
    category: 'polymind',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-ai.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-ai.description',
    hide: true,
    configurable: true,
    // PolyCanvas ships without the AI assistant
    defaultState: false,
  },
  enable_ai_network_search: {
    category: 'polymind',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-ai-network-search.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-ai-network-search.description',
    hide: true,
    configurable: false,
    defaultState: true,
  },
  enable_ai_playground: {
    category: 'polymind',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-ai-model-switch.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-ai-model-switch.description',
    configurable: isCanaryBuild,
    defaultState: isCanaryBuild,
  },
  enable_edgeless_text: {
    category: 'blockmind',
    bsFlag: 'enable_edgeless_text',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-edgeless-text.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-edgeless-text.description',
    configurable: false,
    defaultState: true,
  },
  enable_color_picker: {
    category: 'blockmind',
    bsFlag: 'enable_color_picker',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-color-picker.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-color-picker.description',
    configurable: false,
    defaultState: true,
  },
  enable_ai_chat_block: {
    category: 'blockmind',
    bsFlag: 'enable_ai_chat_block',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-ai-chat-block.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-ai-chat-block.description',
    configurable: false,
    defaultState: true,
  },
  enable_ai_onboarding: {
    category: 'blockmind',
    bsFlag: 'enable_ai_onboarding',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-ai-onboarding.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-ai-onboarding.description',
    configurable: false,
    defaultState: true,
  },
  enable_mind_map_import: {
    category: 'blockmind',
    bsFlag: 'enable_mind_map_import',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-mind-map-import.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-mind-map-import.description',
    configurable: false,
    defaultState: true,
  },
  enable_block_meta: {
    category: 'blockmind',
    bsFlag: 'enable_block_meta',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-block-meta.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-block-meta.description',
    configurable: isCanaryBuild,
    defaultState: true,
  },

  enable_emoji_folder_icon: {
    category: 'polymind',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-emoji-folder-icon.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-emoji-folder-icon.description',

    feedbackType: 'discord',
    feedbackLink:
      'https://discord.com/channels/959027316334407691/1280014319865696351/1280014319865696351',
    configurable: true,
    defaultState: true,
  },
  enable_emoji_doc_icon: {
    category: 'polymind',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-emoji-doc-icon.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-emoji-doc-icon.description',
    feedbackType: 'discord',
    feedbackLink:
      'https://discord.com/channels/959027316334407691/1280014319865696351',
    configurable: true,
    defaultState: true,
  },
  enable_editor_settings: {
    category: 'polymind',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-editor-settings.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-editor-settings.description',
    configurable: false,
    defaultState: true,
  },
  enable_theme_editor: {
    category: 'polymind',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-theme-editor.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-theme-editor.description',
    configurable: isCanaryBuild && !isMobile,
    defaultState: isCanaryBuild,
  },
  enable_advanced_block_visibility: {
    category: 'blockmind',
    bsFlag: 'enable_advanced_block_visibility',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-advanced-block-visibility.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-advanced-block-visibility.description',
    configurable: true,
    defaultState: false,
  },
  enable_mobile_keyboard_toolbar: {
    category: 'blockmind',
    bsFlag: 'enable_mobile_keyboard_toolbar',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-mobile-keyboard-toolbar.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-mobile-keyboard-toolbar.description',
    configurable: false,
    defaultState: isMobile,
  },
  enable_mobile_linked_doc_menu: {
    category: 'blockmind',
    bsFlag: 'enable_mobile_linked_doc_menu',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-mobile-linked-doc-menu.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-mobile-linked-doc-menu.description',
    configurable: false,
    defaultState: isMobile,
  },
  enable_mobile_edgeless_editing: {
    category: 'polymind',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-mobile-edgeless-editing.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-mobile-edgeless-editing.description',
    configurable: isMobile,
    defaultState: false,
  },
  enable_pdf_embed_preview: {
    category: 'polymind',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-pdf-embed-preview.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-pdf-embed-preview.description',
    configurable: !isMobile,
    defaultState: true,
  },
  enable_editor_rtl: {
    category: 'polymind',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-editor-rtl.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-editor-rtl.description',
    configurable: isCanaryBuild,
    defaultState: false,
  },
  enable_mobile_ai_button: {
    category: 'polymind',
    displayName: 'Enable AI Button',
    description: 'Enable AI Button on mobile',
    configurable: isMobile && isIOS,
    defaultState: isMobile && isIOS,
  },
  enable_mermaid_wasm_native_renderer: {
    category: 'polymind',
    displayName: 'Enable Native Mermaid Renderer',
    description:
      'Use the new Mermaid renderer backend. Web uses WASM, desktop uses native, and mobile always uses native. The native renderer is more than 10x faster, but its styling/aesthetic quality and the types of graphics it supports are not as good as the JS version.',
    configurable: !isIOS && !isAndroid,
    defaultState: isIOS || isAndroid,
  },
  enable_turbo_renderer: {
    category: 'blockmind',
    bsFlag: 'enable_turbo_renderer',
    displayName: 'Enable Turbo Renderer',
    description: 'Enable experimental edgeless turbo renderer',
    configurable: isCanaryBuild,
    defaultState: false,
  },
  enable_dom_renderer: {
    category: 'blockmind',
    bsFlag: 'enable_dom_renderer',
    displayName: 'Enable DOM Renderer',
    description: 'Enable DOM renderer for graphics elements',
    configurable: true,
    defaultState: false,
  },
  enable_edgeless_scribbled_style: {
    category: 'blockmind',
    bsFlag: 'enable_edgeless_scribbled_style',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-edgeless-scribbled-style.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-edgeless-scribbled-style.description',
    configurable: isCanaryBuild,
    defaultState: false,
  },
  enable_table_virtual_scroll: {
    category: 'blockmind',
    bsFlag: 'enable_table_virtual_scroll',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-table-virtual-scroll.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-table-virtual-scroll.description',
    configurable: isCanaryBuild,
    defaultState: false,
  },
  enable_setting_subpage_animation: {
    category: 'polymind',
    displayName: 'Enable Setting Subpage Animation',
    description: 'Apply animation for setting subpage open/close',
    configurable: isCanaryBuild,
    defaultState: false,
  },
  enable_adapter_panel: {
    category: 'polymind',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-adapter-panel.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-adapter-panel.description',
    configurable: isCanaryBuild,
    defaultState: false,
  },
  enable_view_analytics_panel: {
    category: 'polymind',
    displayName: 'Enable View Analytics Panel',
    description: 'Show the View analytics tab in the right sidebar.',
    configurable: true,
    defaultState: false,
  },
  enable_two_step_journal_confirmation: {
    category: 'polymind',
    displayName: 'Enable Two Step Journal Confirmation',
    description:
      'When enabled, you must confirm the journal before you can create a new journal.',
    configurable: isCanaryBuild,
    defaultState: isCanaryBuild,
  },
  enable_send_detailed_object_to_ai: {
    category: 'polymind',
    displayName:
      'com.polymind.settings.workspace.experimental-features.enable-ai-send-detailed-object.name',
    description:
      'com.polymind.settings.workspace.experimental-features.enable-ai-send-detailed-object.description',
    configurable: true,
    defaultState: true,
  },
  enable_battery_save_mode: {
    category: 'polymind',
    displayName: 'Enable Battery Save Mode (Require Restart)',
    description:
      'Limit indexing and other compute-intensive tasks on this device, may experience longer loading time and latency in search and other features, in exchange for quietness.',
    configurable: true,
    defaultState: isMobile,
  },
  enable_mobile_database_editing: {
    category: 'blockmind',
    bsFlag: 'enable_mobile_database_editing',
    displayName: 'Enable Mobile Database Editing',
    description: 'Enable mobile database editing',
    configurable: isMobile,
    defaultState: false,
  },
  enable_pdfmake_export: {
    category: 'blockmind',
    bsFlag: 'enable_pdfmake_export',
    displayName: 'Enable PDF Export',
    description:
      'Experimental export PDFs support, it may contain the wrong style.',
    configurable: true,
    defaultState: false,
  },
} satisfies { [key in string]: FlagInfo };

// oxlint-disable-next-line no-redeclare
export type POLYMIND_FLAGS = typeof POLYMIND_FLAGS;
