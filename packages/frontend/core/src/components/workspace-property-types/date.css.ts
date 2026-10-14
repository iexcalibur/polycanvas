import { cssVar } from '@polycanvas/theme';
import { style } from '@vanilla-extract/css';

export const empty = style({
  color: cssVar('placeholderColor'),
});
