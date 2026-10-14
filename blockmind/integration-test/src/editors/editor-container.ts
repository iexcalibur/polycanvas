import { SignalWatcher, WithDisposable } from '@blockmind/polymind/global/lit';
import type { DocMode } from '@blockmind/polymind/model';
import { ThemeProvider } from '@blockmind/polymind/shared/services';
import { BlockStdScope, ShadowlessElement } from '@blockmind/polymind/std';
import {
  type BlockModel,
  type ExtensionType,
  type Store,
} from '@blockmind/polymind/store';
import { computed, signal } from '@preact/signals-core';
import { css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { when } from 'lit/directives/when.js';

export class TestPolymindEditorContainer extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    .polymind-page-viewport {
      position: relative;
      display: flex;
      flex-direction: column;
      overflow-x: hidden;
      overflow-y: auto;
      container-name: viewport;
      container-type: inline-size;
      font-family: var(--polymind-font-family);
    }
    .polymind-page-viewport * {
      box-sizing: border-box;
    }

    @media print {
      .polymind-page-viewport {
        height: auto;
      }
    }

    .playground-page-editor-container {
      flex-grow: 1;
      font-family: var(--polymind-font-family);
      display: block;
    }

    .playground-page-editor-container * {
      box-sizing: border-box;
    }

    @media print {
      .playground-page-editor-container {
        height: auto;
      }
    }

    .edgeless-editor-container {
      font-family: var(--polymind-font-family);
      background: var(--polymind-background-primary-color);
      display: block;
      height: 100%;
      position: relative;
      overflow: clip;
    }

    .edgeless-editor-container * {
      box-sizing: border-box;
    }

    @media print {
      .edgeless-editor-container {
        height: auto;
      }
    }

    .polymind-edgeless-viewport {
      display: block;
      height: 100%;
      position: relative;
      overflow: clip;
      container-name: viewport;
      container-type: inline-size;
    }
  `;

  private readonly _doc = signal<Store>();

  private readonly _edgelessSpecs = signal<ExtensionType[]>([]);

  private readonly _mode = signal<DocMode>('page');

  private readonly _pageSpecs = signal<ExtensionType[]>([]);

  private readonly _specs = computed(() =>
    this._mode.value === 'page'
      ? this._pageSpecs.value
      : this._edgelessSpecs.value
  );

  private readonly _std = computed(() => {
    return new BlockStdScope({
      store: this.doc,
      extensions: this._specs.value,
    });
  });

  private readonly _editorTemplate = computed(() => {
    return this._std.value.render();
  });

  get doc() {
    return this._doc.value as Store;
  }

  set doc(doc: Store) {
    this._doc.value = doc;
  }

  set edgelessSpecs(specs: ExtensionType[]) {
    this._edgelessSpecs.value = specs;
  }

  get edgelessSpecs() {
    return this._edgelessSpecs.value;
  }

  get host() {
    try {
      return this.std.host;
    } catch {
      return null;
    }
  }

  get mode() {
    return this._mode.value;
  }

  set mode(mode: DocMode) {
    this._mode.value = mode;
  }

  set pageSpecs(specs: ExtensionType[]) {
    this._pageSpecs.value = specs;
  }

  get pageSpecs() {
    return this._pageSpecs.value;
  }

  get rootModel() {
    return this.doc.root as BlockModel;
  }

  get std() {
    return this._std.value;
  }

  override connectedCallback() {
    super.connectedCallback();

    this._disposables.add(
      this.doc.slots.rootAdded.subscribe(() => this.requestUpdate())
    );
  }

  override firstUpdated() {
    if (this.mode === 'page') {
      setTimeout(() => {
        if (this.autofocus && this.mode === 'page') {
          const richText = this.querySelector('rich-text');
          const inlineEditor = richText?.inlineEditor;
          inlineEditor?.focusEnd();
        }
      });
    }
  }

  override render() {
    const mode = this._mode.value;
    const themeService = this.std.get(ThemeProvider);
    const appTheme = themeService.app$.value;
    const edgelessTheme = themeService.edgeless$.value;

    return html`${keyed(
      this.rootModel.id + mode,
      html`
        <div
          data-theme=${mode === 'page' ? appTheme : edgelessTheme}
          class=${mode === 'page'
            ? 'polymind-page-viewport'
            : 'polymind-edgeless-viewport'}
        >
          ${when(
            mode === 'page',
            () => html` <doc-title .doc=${this.doc}></doc-title> `
          )}
          <div
            class=${mode === 'page'
              ? 'page-editor playground-page-editor-container'
              : 'edgeless-editor-container'}
          >
            ${this._editorTemplate.value}
          </div>
        </div>
      `
    )}`;
  }

  switchEditor(mode: DocMode) {
    this._mode.value = mode;
  }

  @property({ attribute: false })
  override accessor autofocus = false;
}

declare global {
  interface HTMLElementTagNameMap {
    'polymind-editor-container': TestPolymindEditorContainer;
  }
}
