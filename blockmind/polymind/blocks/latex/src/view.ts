import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@blockmind/polymind-ext-loader';
import { SlashMenuConfigExtension } from '@blockmind/polymind-widget-slash-menu';
import { BlockViewExtension } from '@blockmind/std';
import { literal } from 'lit/static-html.js';

import { latexSlashMenuConfig } from './configs/slash-menu';
import { effects } from './effects';

export class LatexViewExtension extends ViewExtensionProvider {
  override name = 'polymind-latex-block';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register([
      BlockViewExtension('polymind:latex', literal`polymind-latex`),
      SlashMenuConfigExtension('polymind:latex', latexSlashMenuConfig),
    ]);
  }
}
