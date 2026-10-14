import { WorkbenchLink } from '@polycanvas/core/modules/workbench';
import { useI18n } from '@polycanvas/i18n';

import * as styles from './navigation.css';

const items = [
  {
    value: 'docs',
    label: 'com.polymind.docs.header',
    testId: 'workspace-docs-button',
    to: '/all',
  },
  {
    value: 'collections',
    label: 'com.polymind.collections.header',
    testId: 'workspace-collections-button',
    to: '/collection',
  },
  {
    value: 'tags',
    label: 'Tags',
    testId: 'workspace-tags-button',
    to: '/tag',
  },
] as const;

type NavigationKey = (typeof items)[number]['value'];

export const ExplorerNavigation = ({ active }: { active: NavigationKey }) => {
  const t = useI18n();

  return (
    <div className={styles.container}>
      {items.map(item => (
        <WorkbenchLink
          key={item.value}
          data-testid={item.testId}
          data-active={active === item.value}
          to={item.to}
          onClick={() => {}}
          className={styles.item}
        >
          {t[item.label]()}
        </WorkbenchLink>
      ))}
    </div>
  );
};
