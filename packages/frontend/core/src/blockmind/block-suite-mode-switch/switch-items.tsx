import { Tooltip } from '@polycanvas/component';
import { useI18n } from '@polycanvas/i18n';
import { PageIcon, EdgelessIcon } from '@blocksuite/icons/rc';
import type { HTMLAttributes } from 'react';

type SwitchItemProps = {
  active?: boolean;
  hide?: boolean;
  trash?: boolean;
} & HTMLAttributes<HTMLDivElement>;

export const PageSwitchItem = (props: SwitchItemProps) => {
  const t = useI18n();
  return (
    <Tooltip
      content={t['com.polymind.header.mode-switch.page']()}
      shortcut={['$alt', 'S']}
      side="bottom"
    >
      <div {...props}>
        <PageIcon width={20} height={20} />
      </div>
    </Tooltip>
  );
};

export const EdgelessSwitchItem = (props: SwitchItemProps) => {
  const t = useI18n();
  return (
    <Tooltip
      content={t['com.polymind.header.mode-switch.edgeless']()}
      shortcut={['$alt', 'S']}
      side="bottom"
    >
      <div {...props}>
        <EdgelessIcon width={20} height={20} />
      </div>
    </Tooltip>
  );
};
