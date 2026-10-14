import { Avatar, Skeleton } from '@polycanvas/component';
import { useI18n } from '@polycanvas/i18n';
import { CloseIcon } from '@blocksuite/icons/rc';
import { type MouseEventHandler, useCallback } from 'react';

import * as styles from './styles.css';

export interface MemberItemProps {
  userId: string;
  idx?: number;
  maxWidth?: number | string;
  focused?: boolean;
  onRemove?: () => void;
  style?: React.CSSProperties;
}

export const MemberItem = ({
  userId,
  idx,
  focused,
  onRemove,
  style,
  maxWidth,
}: MemberItemProps) => {
  const t = useI18n();
  const handleRemove: MouseEventHandler<HTMLDivElement> = useCallback(
    e => {
      e.stopPropagation();
      onRemove?.();
    },
    [onRemove]
  );

  const name = userId;

  return (
    <div
      className={styles.memberItem}
      data-idx={idx}
      title={name}
      style={style}
    >
      <div
        style={{ maxWidth: maxWidth }}
        data-focused={focused}
        className={styles.memberItemInlineMode}
      >
        <Avatar
          url={null}
          name={name}
          size={16}
          className={styles.memberItemAvatar}
        />
        <div className={styles.memberItemLabel}>{name}</div>
        {onRemove ? (
          <div
            data-testid="remove-tag-button"
            className={styles.memberItemRemove}
            onClick={handleRemove}
          >
            <CloseIcon />
          </div>
        ) : null}
      </div>
    </div>
  );
};
