import { type PolymindTheme, darkTheme, lightTheme } from '@polycanvas/theme';
import {
  type PolymindThemeKeyV2,
  darkThemeV2,
  lightThemeV2,
} from '@polycanvas/theme/v2';
import { useTheme } from 'next-themes';

export const useThemeValueV2 = (key: PolymindThemeKeyV2) => {
  const { resolvedTheme } = useTheme();

  return resolvedTheme === 'dark' ? darkThemeV2[key] : lightThemeV2[key];
};

export const useThemeValueV1 = (key: keyof Omit<PolymindTheme, 'editorMode'>) => {
  const { resolvedTheme } = useTheme();

  return resolvedTheme === 'dark' ? darkTheme[key] : lightTheme[key];
};
