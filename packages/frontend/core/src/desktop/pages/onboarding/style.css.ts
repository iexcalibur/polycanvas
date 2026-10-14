import { cssVar } from '@polycanvas/theme';
import { style } from '@vanilla-extract/css';

export const container = style({
  width: '100vw',
  height: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  backgroundColor: cssVar('backgroundPrimaryColor'),
  backgroundSize: 'cover',
});

export const content = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1,
  marginTop: 'auto',
});

export const title = style({
  fontSize: '36px',
  fontWeight: 700,
  color: cssVar('textPrimaryColor'),
  margin: '24px 0 0',
});

export const subtitle = style({
  fontSize: '16px',
  color: cssVar('textSecondaryColor'),
  textAlign: 'center',
  lineHeight: 1.6,
  margin: '12px 0 0',
});

export const illustration = style({
  maxWidth: '100%',
  width: '670px',
  marginTop: 'auto',
});
