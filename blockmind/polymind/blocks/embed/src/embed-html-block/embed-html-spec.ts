import { EmbedHtmlBlockSchema } from '@blockmind/polymind-model';
import { BlockViewExtension } from '@blockmind/std';
import type { ExtensionType } from '@blockmind/store';
import { literal } from 'lit/static-html.js';

import { createBuiltinToolbarConfigExtension } from './configs/toolbar';
import { EmbedEdgelessHtmlBlockInteraction } from './embed-edgeless-html-block';

const flavour = EmbedHtmlBlockSchema.model.flavour;

export const EmbedHtmlViewExtensions: ExtensionType[] = [
  BlockViewExtension(flavour, model => {
    return model.parent?.flavour === 'polymind:surface'
      ? literal`polymind-embed-edgeless-html-block`
      : literal`polymind-embed-html-block`;
  }),
  createBuiltinToolbarConfigExtension(flavour),
  EmbedEdgelessHtmlBlockInteraction,
].flat();
