import type { IconButtonProps } from '@polycanvas/component';
import { IconButton } from '@polycanvas/component';
import { useI18n } from '@polycanvas/i18n';
import { FavoritedIcon, FavoriteIcon } from '@blocksuite/icons/rc';
import { cssVar } from '@polycanvas/theme';
import { forwardRef, useCallback } from 'react';

export const FavoriteTag = forwardRef<
  HTMLButtonElement,
  {
    active: boolean;
  } & Omit<IconButtonProps, 'children'>
>(({ active, onClick, ...props }, ref) => {
  const t = useI18n();
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      e.preventDefault();
      onClick?.(e);
    },
    [onClick]
  );
  return (
    <IconButton
      tooltip={active ? t['Favorited']() : t['Favorite']()}
      tooltipOptions={{ side: 'top' }}
      ref={ref}
      onClick={handleClick}
      size="20"
      {...props}
    >
      {active ? (
        <FavoritedIcon
          color={cssVar('primaryColor')}
          data-testid="favorited-icon"
        />
      ) : (
        <FavoriteIcon />
      )}
    </IconButton>
  );
});
FavoriteTag.displayName = 'FavoriteTag';
