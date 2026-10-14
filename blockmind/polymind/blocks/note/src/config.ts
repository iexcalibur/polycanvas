import type { NoteBlockModel } from '@blockmind/polymind-model';
import { type BlockStdScope, ConfigExtensionFactory } from '@blockmind/std';
import type { TemplateResult } from 'lit';

type NoteBlockContext = {
  note: NoteBlockModel;
  std: BlockStdScope;
};

export type NoteConfig = {
  edgelessNoteHeader: (context: NoteBlockContext) => TemplateResult;
  pageBlockTitle: (context: NoteBlockContext) => TemplateResult;
  /**
   * @returns if the viewport fit animation executed
   */
  pageBlockViewportFitAnimation?: (context: NoteBlockContext) => boolean;
};

export const NoteConfigExtension =
  ConfigExtensionFactory<NoteConfig>('polymind:note');
