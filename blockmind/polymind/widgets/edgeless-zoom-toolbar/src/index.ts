import { EdgelessLegacySlotIdentifier } from '@blockmind/polymind-block-surface';
import type { RootBlockModel } from '@blockmind/polymind-model';
import { WidgetComponent, WidgetViewExtension } from '@blockmind/std';
import { GfxControllerIdentifier } from '@blockmind/std/gfx';
import { effect } from '@preact/signals-core';
import { css, html, nothing } from 'lit';
import { state } from 'lit/decorators.js';
import { literal, unsafeStatic } from 'lit/static-html.js';

export const POLYMIND_EDGELESS_ZOOM_TOOLBAR_WIDGET =
  'polymind-edgeless-zoom-toolbar-widget';

export class PolymindEdgelessZoomToolbarWidget extends WidgetComponent<RootBlockModel> {
  static override styles = css`
    :host {
      position: absolute;
      bottom: 20px;
      left: 12px;
      z-index: var(--polymind-z-index-popover);
      display: flex;
      justify-content: center;
      -webkit-user-select: none;
      user-select: none;
    }

    @container viewport (width <= 1200px) {
      edgeless-zoom-toolbar {
        display: none;
      }
    }

    @container viewport (width > 1200px) {
      zoom-bar-toggle-button {
        display: none;
      }
    }
  `;

  get edgeless() {
    return this.block;
  }

  get gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  override connectedCallback() {
    super.connectedCallback();

    this.disposables.add(
      effect(() => {
        const currentTool = this.gfx.tool.currentToolName$.value;

        if (currentTool !== 'frameNavigator') {
          this._hide = false;
        }
        this.requestUpdate();
      })
    );
  }

  override firstUpdated() {
    const { disposables, std } = this;
    const slots = std.get(EdgelessLegacySlotIdentifier);

    disposables.add(
      slots.navigatorSettingUpdated.subscribe(({ hideToolbar }) => {
        if (hideToolbar !== undefined) {
          this._hide = hideToolbar;
        }
      })
    );
  }

  override render() {
    if (this._hide || !this.edgeless) {
      return nothing;
    }

    return html`
      <edgeless-zoom-toolbar .std=${this.std}></edgeless-zoom-toolbar>
      <zoom-bar-toggle-button .std=${this.std}></zoom-bar-toggle-button>
    `;
  }

  @state()
  private accessor _hide = false;
}

export const edgelessZoomToolbarWidget = WidgetViewExtension(
  'polymind:page',
  POLYMIND_EDGELESS_ZOOM_TOOLBAR_WIDGET,
  literal`${unsafeStatic(POLYMIND_EDGELESS_ZOOM_TOOLBAR_WIDGET)}`
);
