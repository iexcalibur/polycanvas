import { textKeymap } from '@blockmind/polymind-inline-preset';
import { CodeBlockSchema } from '@blockmind/polymind-model';
import { KeymapExtension } from '@blockmind/std';

export const CodeKeymapExtension = KeymapExtension(textKeymap, {
  flavour: CodeBlockSchema.model.flavour,
});
