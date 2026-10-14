import {
  type StoreExtensionContext,
  StoreExtensionProvider,
} from '@blockmind/polymind-ext-loader';
import { FrameBlockSchemaExtension } from '@blockmind/polymind-model';

export class FrameStoreExtension extends StoreExtensionProvider {
  override name = 'polymind-frame-block';

  override setup(context: StoreExtensionContext) {
    super.setup(context);
    context.register([FrameBlockSchemaExtension]);
  }
}
