import { cssVar } from '@polycanvas/theme';
import { cssVarV2 } from '@polycanvas/theme/v2';
import { style } from '@vanilla-extract/css';
export const menuContent = style({
  backgroundColor: cssVar('backgroundOverlayPanelColor'),
});
export const button = style({
  backgroundColor: cssVarV2.button.secondary,
});
