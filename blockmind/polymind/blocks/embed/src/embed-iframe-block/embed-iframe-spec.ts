import { EmbedIframeBlockSchema } from '@blockmind/polymind-model';
import { SlashMenuConfigExtension } from '@blockmind/polymind-widget-slash-menu';
import { BlockViewExtension, FlavourExtension } from '@blockmind/std';
import type { ExtensionType } from '@blockmind/store';
import { literal } from 'lit/static-html.js';

import { embedIframeSlashMenuConfig } from './configs/slash-menu/slash-menu';
import { createBuiltinToolbarConfigExtension } from './configs/toolbar';
import { EmbedIframeInteraction } from './embed-edgeless-iframe-block';

const flavour = EmbedIframeBlockSchema.model.flavour;

export const EmbedIframeViewExtensions: ExtensionType[] = [
  FlavourExtension(flavour),
  BlockViewExtension(flavour, model => {
    return model.parent?.flavour === 'polymind:surface'
      ? literal`polymind-embed-edgeless-iframe-block`
      : literal`polymind-embed-iframe-block`;
  }),
  createBuiltinToolbarConfigExtension(flavour),
  SlashMenuConfigExtension(flavour, embedIframeSlashMenuConfig),
  EmbedIframeInteraction,
].flat();
