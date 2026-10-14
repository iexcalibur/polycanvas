import type { ReferenceParams } from '@blockmind/polymind-model';
import { createIdentifier } from '@blockmind/global/di';
import type { ExtensionType } from '@blockmind/store';

export interface GenerateDocUrlService {
  generateDocUrl: (docId: string, params?: ReferenceParams) => string | void;
}

export const GenerateDocUrlProvider = createIdentifier<GenerateDocUrlService>(
  'GenerateDocUrlService'
);

export function GenerateDocUrlExtension(
  generateDocUrlProvider: GenerateDocUrlService
): ExtensionType {
  return {
    setup: di => {
      di.addImpl(GenerateDocUrlProvider, generateDocUrlProvider);
    },
  };
}
