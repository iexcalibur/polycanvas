import {
  EmbedFigmaBlockSchema,
  EmbedFigmaStyles,
} from '@blockmind/polymind-model';
import { EmbedOptionConfig } from '@blockmind/polymind-shared/services';

import { figmaUrlRegex } from './embed-figma-model.js';

export const EmbedFigmaBlockOptionConfig = EmbedOptionConfig({
  flavour: EmbedFigmaBlockSchema.model.flavour,
  urlRegex: figmaUrlRegex,
  styles: EmbedFigmaStyles,
  viewType: 'embed',
});
