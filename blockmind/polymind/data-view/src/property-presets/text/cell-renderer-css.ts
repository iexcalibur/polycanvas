import { css } from '@emotion/css';
import { baseTheme } from '@polycanvas/theme';

export const textStyle = css({
  display: 'flex',
  alignItems: 'center',
  height: '100%',
  width: '100%',
  padding: '0',
  border: 'none',
  fontFamily: baseTheme.fontSansFamily,
  fontSize: 'var(--polymind-font-base)',
  lineHeight: 'var(--polymind-line-height)',
  color: 'var(--polymind-text-primary-color)',
  fontWeight: '400',
  backgroundColor: 'transparent',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const textInputStyle = css({
  display: 'flex',
  alignItems: 'center',
  height: '100%',
  width: '100%',
  padding: '0',
  border: 'none',
  fontFamily: baseTheme.fontSansFamily,
  fontSize: 'var(--polymind-font-base)',
  lineHeight: 'var(--polymind-line-height)',
  color: 'var(--polymind-text-primary-color)',
  fontWeight: '400',
  backgroundColor: 'transparent',
  cursor: 'text',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  ':focus': {
    outline: 'none',
  },
});
