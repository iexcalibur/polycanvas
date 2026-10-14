import type { FootNote, ReferenceInfo } from '@blockmind/polymind-model';
import type { InlineEditor } from '@blockmind/std/inline';
import type { BlockModel } from '@blockmind/store';
export * from './uni-component';

export type NoteChildrenFlavour =
  | 'polymind:paragraph'
  | 'polymind:list'
  | 'polymind:code'
  | 'polymind:divider'
  | 'polymind:database'
  | 'polymind:data-view'
  | 'polymind:image'
  | 'polymind:bookmark'
  | 'polymind:attachment'
  | 'polymind:surface-ref';

export interface Viewport {
  left: number;
  top: number;
  scrollLeft: number;
  scrollTop: number;
  scrollWidth: number;
  scrollHeight: number;
  clientWidth: number;
  clientHeight: number;
}

export type ExtendedModel = BlockModel & Record<string, any>;

export type IndentContext = {
  blockId: string;
  inlineIndex: number;
  flavour: string;
  type: 'indent' | 'dedent';
};

export type PolymindTextStyleAttributes = {
  bold?: true | null;
  italic?: true | null;
  underline?: true | null;
  strike?: true | null;
  code?: true | null;
  color?: string | null;
  background?: string | null;
};

export type PolymindTextAttributes = PolymindTextStyleAttributes & {
  link?: string | null;
  reference?:
    | ({
        type: 'Subpage' | 'LinkedPage';
      } & ReferenceInfo)
    | null;
  latex?: string | null;
  footnote?: FootNote | null;
  mention?: {
    member: string;
    notification?: string;
  } | null;
  [key: `comment-${string}`]: boolean | null;
};

export type PolymindInlineEditor = InlineEditor<PolymindTextAttributes>;

export type SelectedRect = {
  left: number;
  top: number;
  width: number;
  height: number;
  borderWidth: number;
  borderStyle: string;
  rotate: number;
};
