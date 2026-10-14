import { useCallback } from 'react';

export const useSignOut = (_props?: Record<string, unknown>) => {
  const confirmSignOut = useCallback(() => {
  }, []);

  return confirmSignOut;
};
