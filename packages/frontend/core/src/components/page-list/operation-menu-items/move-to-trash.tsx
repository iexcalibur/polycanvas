import type { ConfirmModalProps, MenuItemProps } from '@polycanvas/component';
import { ConfirmModal, MenuItem } from '@polycanvas/component';
import { useI18n } from '@polycanvas/i18n';
import { DeleteIcon } from '@blocksuite/icons/rc';

export const MoveToTrash = (props: MenuItemProps) => {
  const t = useI18n();

  return (
    <MenuItem prefixIcon={<DeleteIcon />} type="danger" {...props}>
      {t['com.polymind.moveToTrash.title']()}
    </MenuItem>
  );
};

const MoveToTrashConfirm = ({
  titles,
  ...confirmModalProps
}: {
  titles: string[];
} & ConfirmModalProps) => {
  const t = useI18n();
  const multiple = titles.length > 1;
  const title = multiple
    ? t['com.polymind.moveToTrash.confirmModal.title.multiple']({
        number: titles.length.toString(),
      })
    : t['com.polymind.moveToTrash.confirmModal.title']();
  const description = multiple
    ? t['com.polymind.moveToTrash.confirmModal.description.multiple']({
        number: titles.length.toString(),
      })
    : t['com.polymind.moveToTrash.confirmModal.description']({
        title: titles[0] || t['Untitled'](),
      });
  return (
    <ConfirmModal
      title={title}
      description={description}
      cancelText={t['com.polymind.confirmModal.button.cancel']()}
      confirmText={t.Delete()}
      confirmButtonOptions={{
        ['data-testid' as string]: 'confirm-delete-page',
        variant: 'error',
      }}
      {...confirmModalProps}
    />
  );
};

MoveToTrash.ConfirmModal = MoveToTrashConfirm;
