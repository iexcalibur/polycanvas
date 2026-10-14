import { EmbedYoutubeBlockSchema } from '@blockmind/polymind-model';
import { SlashMenuConfigExtension } from '@blockmind/polymind-widget-slash-menu';
import { BlockViewExtension, FlavourExtension } from '@blockmind/std';
import type { ExtensionType } from '@blockmind/store';
import { literal } from 'lit/static-html.js';

import { createBuiltinToolbarConfigExtension } from '../configs/toolbar';
import { embedYoutubeSlashMenuConfig } from './configs/slash-menu';
import { EmbedYoutubeBlockInteraction } from './embed-edgeless-youtube-block';
import { EmbedYoutubeBlockComponent } from './embed-youtube-block';
import {
  EmbedYoutubeBlockOptionConfig,
  EmbedYoutubeBlockService,
} from './embed-youtube-service';

const flavour = EmbedYoutubeBlockSchema.model.flavour;

export const EmbedYoutubeViewExtensions: ExtensionType[] = [
  FlavourExtension(flavour),
  EmbedYoutubeBlockService,
  BlockViewExtension(flavour, model => {
    return model.parent?.flavour === 'polymind:surface'
      ? literal`polymind-embed-edgeless-youtube-block`
      : literal`polymind-embed-youtube-block`;
  }),
  EmbedYoutubeBlockOptionConfig,
  createBuiltinToolbarConfigExtension(flavour, EmbedYoutubeBlockComponent),
  SlashMenuConfigExtension('polymind:embed-youtube', embedYoutubeSlashMenuConfig),
  EmbedYoutubeBlockInteraction,
].flat();
