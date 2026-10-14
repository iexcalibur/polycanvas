import {
  CodeBlockModel,
  type DatabaseBlockModel,
  ListBlockModel,
  ParagraphBlockModel,
  type RootBlockModel,
} from '@blockmind/polymind-model';
import { REFERENCE_NODE } from '@blockmind/polymind-shared/consts';
import type { PolymindTextAttributes } from '@blockmind/polymind-shared/types';
import { createDefaultDoc, matchModels } from '@blockmind/polymind-shared/utils';
import type { DetailSlotProps, SingleView } from '@blockmind/data-view';
import { SignalWatcher, WithDisposable } from '@blockmind/global/lit';
import { type EditorHost, ShadowlessElement } from '@blockmind/std';
import type { BaseTextAttributes } from '@blockmind/store';
import { computed } from '@preact/signals-core';
import { cssVarV2 } from '@polycanvas/theme/v2';
import { css, html, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';

import { isPureText } from '../utils/title-doc.js';

export class NoteRenderer
  extends SignalWatcher(WithDisposable(ShadowlessElement))
  implements DetailSlotProps
{
  static override styles = css`
    database-datasource-note-renderer {
      width: 100%;
      --polymind-editor-side-padding: 0;
      flex: 1;
    }
  `;

  @property({ attribute: false })
  accessor rowId!: string;

  rowText$ = computed(() => {
    return this.databaseBlock.store.getBlock(this.rowId)?.model?.text;
  });

  allowCreateDoc$ = computed(() => {
    return isPureText(this.rowText$.value);
  });

  get databaseBlock(): DatabaseBlockModel {
    return this.model;
  }

  addNote() {
    const collection = this.host?.std.workspace;
    if (!collection) {
      return;
    }
    const note = createDefaultDoc(collection);
    if (note) {
      this.openDoc(note.id);
      const rowContent = this.rowText$.value?.toString();
      this.rowText$.value?.replace(
        0,
        this.rowText$.value.length,
        REFERENCE_NODE,
        {
          reference: {
            type: 'LinkedPage',
            pageId: note.id,
          },
        } satisfies PolymindTextAttributes as BaseTextAttributes
      );
      collection.meta.setDocMeta(note.id, { title: rowContent });
      if (note.root) {
        (note.root as RootBlockModel).props.title.insert(rowContent ?? '', 0);
        note.root.children
          .find(child => child.flavour === 'polymind:note')
          ?.children.find(block =>
            matchModels(block, [
              ParagraphBlockModel,
              ListBlockModel,
              CodeBlockModel,
            ])
          );
      }
      // Track when a linked doc is created in database title column
    }
  }

  protected override render(): unknown {
    return html`
      <div
        style="height: 1px;max-width: var(--polymind-editor-width);background-color: ${unsafeCSS(
          cssVarV2.layer.insideBorder.border
        )};margin: auto;margin-bottom: 16px"
      ></div>
      ${this.renderNote()}
    `;
  }

  renderNote() {
    if (this.allowCreateDoc$.value) {
      return html` <div>
        <div
          @click="${this.addNote}"
          style="max-width: var(--polymind-editor-width);margin: auto;cursor: pointer;color: var(--polymind-text-disable-color)"
        >
          Click to create a linked doc in center peek.
        </div>
      </div>`;
    }
    return;
  }

  @property({ attribute: false })
  accessor host!: EditorHost;

  @property({ attribute: false })
  accessor model!: DatabaseBlockModel;

  @property({ attribute: false })
  accessor openDoc!: (docId: string) => void;

  @property({ attribute: false })
  accessor view!: SingleView;
}
