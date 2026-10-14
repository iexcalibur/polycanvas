import { globalStyle } from '@vanilla-extract/css';

globalStyle('*', {
  margin: 0,
  padding: 0,
});

globalStyle('body', {
  color: 'var(--polymind-text-primary-color)',
  fontFamily: 'var(--polymind-font-family)',
  fontSize: 'var(--polymind-font-base)',
  lineHeight: 'var(--polymind-font-height)',
  backgroundColor: 'var(--polymind-background-primary-color)',
});

globalStyle('.docs-story', {
  backgroundColor: 'var(--polymind-background-primary-color)',
});

globalStyle('body.sb-main-fullscreen', {
  overflowY: 'auto',
});
