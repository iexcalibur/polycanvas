// corresponding to `formatText` command
import { TableModelFlavour } from '@blockmind/polymind-model';

export const FORMAT_TEXT_SUPPORT_FLAVOURS = [
  'polymind:paragraph',
  'polymind:list',
  'polymind:code',
];
// corresponding to `formatBlock` command
export const FORMAT_BLOCK_SUPPORT_FLAVOURS = [
  'polymind:paragraph',
  'polymind:list',
  'polymind:code',
];
// corresponding to `formatNative` command
export const FORMAT_NATIVE_SUPPORT_FLAVOURS = [
  'polymind:database',
  TableModelFlavour,
];
