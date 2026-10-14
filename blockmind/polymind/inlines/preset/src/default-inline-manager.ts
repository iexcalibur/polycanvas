import { FootNoteInlineSpecExtension } from '@blockmind/polymind-inline-footnote';
import { LatexInlineSpecExtension } from '@blockmind/polymind-inline-latex';
import { LinkInlineSpecExtension } from '@blockmind/polymind-inline-link';
import { MentionInlineSpecExtension } from '@blockmind/polymind-inline-mention';
import { ReferenceInlineSpecExtension } from '@blockmind/polymind-inline-reference';
import type { PolymindTextAttributes } from '@blockmind/polymind-shared/types';
import { InlineManagerExtension } from '@blockmind/std/inline';

import {
  BackgroundInlineSpecExtension,
  BoldInlineSpecExtension,
  CodeInlineSpecExtension,
  ColorInlineSpecExtension,
  ItalicInlineSpecExtension,
  StrikeInlineSpecExtension,
  UnderlineInlineSpecExtension,
} from './inline-spec';

export const DefaultInlineManagerExtension =
  InlineManagerExtension<PolymindTextAttributes>({
    id: 'DefaultInlineManager',
    specs: [
      BoldInlineSpecExtension.identifier,
      ItalicInlineSpecExtension.identifier,
      UnderlineInlineSpecExtension.identifier,
      StrikeInlineSpecExtension.identifier,
      CodeInlineSpecExtension.identifier,
      BackgroundInlineSpecExtension.identifier,
      ColorInlineSpecExtension.identifier,
      LatexInlineSpecExtension.identifier,
      ReferenceInlineSpecExtension.identifier,
      LinkInlineSpecExtension.identifier,
      FootNoteInlineSpecExtension.identifier,
      MentionInlineSpecExtension.identifier,
    ],
  });
