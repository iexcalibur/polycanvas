import type {
  AttributeRenderer,
  InlineEditor,
  InlineRange,
} from '@blockmind/std/inline';
import type { BaseTextAttributes, DeltaInsert } from '@blockmind/store';
import type * as Y from 'yjs';
import type { AnyZodObject, KeySchema, ZodEffects, ZodRecord } from 'zod';

export type InlineSpecs<
  TextAttributes extends BaseTextAttributes = BaseTextAttributes,
> = {
  name: keyof TextAttributes | string;
  schema:
    | AnyZodObject
    | ZodEffects<
        ZodRecord<KeySchema>,
        Partial<Record<string, unknown>>,
        unknown
      >;
  match: (delta: DeltaInsert<TextAttributes>) => boolean;
  renderer: AttributeRenderer<TextAttributes>;
  embed?: boolean;
  wrapper?: boolean;
};

export type InlineMarkdownMatchAction<
  // @ts-expect-error We allow to covariance for PolymindTextAttributes
  in PolymindTextAttributes extends BaseTextAttributes = BaseTextAttributes,
> = (props: {
  inlineEditor: InlineEditor<PolymindTextAttributes>;
  prefixText: string;
  inlineRange: InlineRange;
  pattern: RegExp;
  undoManager: Y.UndoManager;
}) => void;

export type InlineMarkdownMatch<
  PolymindTextAttributes extends BaseTextAttributes = BaseTextAttributes,
> = {
  name: string;
  pattern: RegExp;
  action: InlineMarkdownMatchAction<PolymindTextAttributes>;
};
