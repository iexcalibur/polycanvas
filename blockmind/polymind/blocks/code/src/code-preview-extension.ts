import type { CodeBlockModel } from '@blockmind/polymind-model';
import { createIdentifier } from '@blockmind/global/di';
import type { ExtensionType } from '@blockmind/store';
import type { HTMLTemplateResult } from 'lit';

export type CodeBlockPreviewRenderer = (
  model: CodeBlockModel
) => HTMLTemplateResult | null;

export type CodeBlockPreviewContext = {
  renderer: CodeBlockPreviewRenderer;
  lang: string;
};

export const CodeBlockPreviewIdentifier =
  createIdentifier<CodeBlockPreviewContext>('CodeBlockPreview');

export function CodeBlockPreviewExtension(
  lang: string,
  renderer: CodeBlockPreviewRenderer
): ExtensionType {
  return {
    setup: di => {
      di.addImpl(CodeBlockPreviewIdentifier(lang), { renderer, lang });
    },
  };
}
