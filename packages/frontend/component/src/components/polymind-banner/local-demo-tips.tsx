import { IconButton } from '@polycanvas/component/ui/button';
import { CloseIcon } from '@blocksuite/icons/rc';

import * as styles from './index.css';

type LocalDemoTipsProps = {
  isLoggedIn?: boolean;
  onLogin?: () => void;
  onEnableCloud?: () => void;
  onClose: () => void;
};

export const LocalDemoTips = ({ onClose }: LocalDemoTipsProps) => {
  return (
    <div className={styles.tipsContainer} data-testid="local-demo-tips">
      <div className={styles.tipsMessage}>
        Your data is stored locally on this device. Export regularly to keep it
        safe.
      </div>

      <div className={styles.tipsRightItem}>
        <IconButton
          onClick={onClose}
          size="20"
          data-testid="local-demo-tips-close-button"
        >
          <CloseIcon />
        </IconButton>
      </div>
    </div>
  );
};

export default LocalDemoTips;
