import { EmbedFigmaBlockSchema } from '@blockmind/polymind-model';
import { SlashMenuConfigExtension } from '@blockmind/polymind-widget-slash-menu';
import { BlockViewExtension, FlavourExtension } from '@blockmind/std';
import type { ExtensionType } from '@blockmind/store';
import { literal } from 'lit/static-html.js';

import { createBuiltinToolbarConfigExtension } from '../configs/toolbar';
import { embedFigmaSlashMenuConfig } from './configs/slash-menu';
import { EmbedFigmaBlockInteraction } from './embed-edgeless-figma-block';
import { EmbedFigmaBlockComponent } from './embed-figma-block';
import { EmbedFigmaBlockOptionConfig } from './embed-figma-service';

const flavour = EmbedFigmaBlockSchema.model.flavour;

export const EmbedFigmaViewExtensions: ExtensionType[] = [
  FlavourExtension(flavour),
  BlockViewExtension(flavour, model => {
    return model.parent?.flavour === 'polymind:surface'
      ? literal`polymind-embed-edgeless-figma-block`
      : literal`polymind-embed-figma-block`;
  }),
  EmbedFigmaBlockOptionConfig,
  createBuiltinToolbarConfigExtension(flavour, EmbedFigmaBlockComponent),
  SlashMenuConfigExtension(flavour, embedFigmaSlashMenuConfig),
  EmbedFigmaBlockInteraction,
].flat();
