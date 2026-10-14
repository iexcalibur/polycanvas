import {
  EmbedSyncedDocBlockSchema,
  type EmbedSyncedDocModel,
} from '@blockmind/polymind-model';
import { type BlockStdScope, ConfigExtensionFactory } from '@blockmind/std';
import type { TemplateResult } from 'lit';

export type EmbedSyncedDocConfig = {
  edgelessHeader: (context: {
    model: EmbedSyncedDocModel;
    std: BlockStdScope;
  }) => TemplateResult;
};

export const EmbedSyncedDocConfigExtension =
  ConfigExtensionFactory<EmbedSyncedDocConfig>(
    EmbedSyncedDocBlockSchema.model.flavour
  );
