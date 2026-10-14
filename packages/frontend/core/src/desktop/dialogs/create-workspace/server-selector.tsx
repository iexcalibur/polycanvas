import { type HTMLAttributes, type ReactNode } from 'react';

import * as styles from './server-selector.css';

export interface ServerSelectorProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  'onChange'
> {
  selectedId: string;
  onChange: (id: string) => void;
  placeholder?: ReactNode;
}
export const ServerSelector = ({
  selectedId: _selectedId,
  onChange: _onChange,
  placeholder: _placeholder,
  className: _className,
  ..._props
}: ServerSelectorProps) => {
  return <div className={styles.trigger}>Local</div>;
};
