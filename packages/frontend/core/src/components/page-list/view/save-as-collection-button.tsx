import { Button, usePromptModal } from '@polycanvas/component';
import { useI18n } from '@polycanvas/i18n';
import { SaveIcon } from '@blocksuite/icons/rc';
import { useCallback } from 'react';

import * as styles from './save-as-collection-button.css';

interface SaveAsCollectionButtonProps {
  onConfirm: (collectionName: string) => void;
}

export const SaveAsCollectionButton = ({
  onConfirm,
}: SaveAsCollectionButtonProps) => {
  const t = useI18n();
  const { openPromptModal } = usePromptModal();
  const handleClick = useCallback(() => {
    openPromptModal({
      title: t['com.polymind.editCollection.saveCollection'](),
      label: t['com.polymind.editCollectionName.name'](),
      inputOptions: {
        placeholder: t['com.polymind.editCollectionName.name.placeholder'](),
      },
      children: (
        <div className={styles.createTips}>
          {t['com.polymind.editCollectionName.createTips']()}
        </div>
      ),
      confirmText: t['com.polymind.editCollection.save'](),
      cancelText: t['com.polymind.editCollection.button.cancel'](),
      confirmButtonOptions: {
        variant: 'primary',
      },
      onConfirm(name) {
        onConfirm(name);
      },
    });
  }, [openPromptModal, t, onConfirm]);
  return (
    <Button
      onClick={handleClick}
      data-testid="save-as-collection"
      prefix={<SaveIcon />}
      className={styles.button}
    >
      {t['com.polymind.editCollection.saveCollection']()}
    </Button>
  );
};
