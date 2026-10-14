import { FrameBlockSchema } from '@blockmind/polymind-model';
import { BlockViewExtension } from '@blockmind/std';
import type { ExtensionType } from '@blockmind/store';
import { literal } from 'lit/static-html.js';

import { FrameBlockInteraction } from './frame-block';
import { EdgelessFrameManager, FrameOverlay } from './frame-manager';

const flavour = FrameBlockSchema.model.flavour;

export const FrameBlockSpec: ExtensionType[] = [
  BlockViewExtension(flavour, literal`polymind-frame`),
  FrameOverlay,
  EdgelessFrameManager,
  FrameBlockInteraction,
];
