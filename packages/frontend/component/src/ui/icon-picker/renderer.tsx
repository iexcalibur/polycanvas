import type { ReactNode } from 'react';

import { PolymindIconRenderer } from './renderer/polymind-icon';
import { type IconData, IconType } from './type';

export const IconRenderer = ({
  data,
  fallback,
}: {
  data?: IconData;
  fallback?: ReactNode;
}) => {
  if (!data) {
    return fallback ?? null;
  }

  if (data.type === IconType.Emoji && data.unicode) {
    return data.unicode;
  }
  if (data.type === IconType.PolymindIcon && data.name) {
    return <PolymindIconRenderer name={data.name} color={data.color} />;
  }
  if (data.type === IconType.Blob) {
    // Not supported yet
    return null;
  }

  return fallback ?? null;
};
