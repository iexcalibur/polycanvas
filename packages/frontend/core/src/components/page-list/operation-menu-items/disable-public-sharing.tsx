import type { MenuItemProps } from '@polycanvas/component';
import { MenuItem } from '@polycanvas/component';
import { useI18n } from '@polycanvas/i18n';
import { ShareIcon } from '@blocksuite/icons/rc';

export const DisablePublicSharing = (props: MenuItemProps) => {
  const t = useI18n();
  return (
    <MenuItem type="danger" prefixIcon={<ShareIcon />} {...props}>
      {t['Disable Public Sharing']()}
    </MenuItem>
  );
};
