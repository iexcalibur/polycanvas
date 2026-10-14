import { useI18n } from '@polycanvas/i18n';

import { Button } from '../../ui/button';
import { AuthPageContainer } from '../auth-components';

export const ExpiredPage = ({ onOpenPolymind }: { onOpenPolymind: () => void }) => {
  const t = useI18n();
  return (
    <AuthPageContainer
      title={t['com.polymind.expired.page.title']()}
      subtitle={t['com.polymind.expired.page.new-subtitle']()}
    >
      <Button variant="primary" size="large" onClick={onOpenPolymind}>
        {t['com.polymind.auth.open.polymind']()}
      </Button>
    </AuthPageContainer>
  );
};
