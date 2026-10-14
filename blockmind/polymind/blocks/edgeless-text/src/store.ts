import {
  type StoreExtensionContext,
  StoreExtensionProvider,
} from '@blockmind/polymind-ext-loader';
import { EdgelessTextBlockSchemaExtension } from '@blockmind/polymind-model';

export class EdgelessTextStoreExtension extends StoreExtensionProvider {
  override name = 'polymind-edgeless-text-block';

  override setup(context: StoreExtensionContext) {
    super.setup(context);
    context.register(EdgelessTextBlockSchemaExtension);
  }
}
