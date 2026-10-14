import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blockmind/polymind-ext-loader';
import { TableModelFlavour } from '@blockmind/polymind-model';
import { SlashMenuConfigExtension } from '@blockmind/polymind-widget-slash-menu';
import { BlockViewExtension, FlavourExtension } from '@blockmind/std';
import { literal } from 'lit/static-html.js';

import { tableSlashMenuConfig } from './configs/slash-menu';
import { effects } from './effects';

export class TableViewExtension extends ViewExtensionProvider {
  override name = 'polymind-table-block';

  override effect(): void {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register([
      FlavourExtension(TableModelFlavour),
      BlockViewExtension(TableModelFlavour, literal`polymind-table`),
      SlashMenuConfigExtension(TableModelFlavour, tableSlashMenuConfig),
    ]);
  }
}
