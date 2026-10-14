import { AppContainer } from '@polycanvas/core/desktop/components/app-container';

import { PageNotFound } from '../../404';

export const SharePage = ({
  workspaceId: _workspaceId,
  docId: _docId,
}: {
  workspaceId: string;
  docId: string;
}) => {
  return (
    <AppContainer>
      <PageNotFound noPermission />
    </AppContainer>
  );
};
