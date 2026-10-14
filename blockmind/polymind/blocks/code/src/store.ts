import {
  type StoreExtensionContext,
  StoreExtensionProvider,
} from '@blockmind/polymind-ext-loader';
import { CodeBlockSchemaExtension } from '@blockmind/polymind-model';

import { CodeBlockAdapterExtensions } from './adapters/extension';
import { CodeMarkdownPreprocessorExtension } from './adapters/markdown/preprocessor';

export class CodeStoreExtension extends StoreExtensionProvider {
  override name = 'polymind-code-block';

  override setup(context: StoreExtensionContext) {
    super.setup(context);
    context.register(CodeBlockSchemaExtension);
    context.register(CodeBlockAdapterExtensions);
    context.register(CodeMarkdownPreprocessorExtension);
  }
}
