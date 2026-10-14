import {
  AuthPageContainer,
  type User,
} from '@polycanvas/component/auth-components';
import type { GetInviteInfoQuery } from '@polycanvas/graphql';
import { Trans, useI18n } from '@polycanvas/i18n';

import { Avatar } from '../../ui/avatar';
import * as styles from './styles.css';
export const SentRequestPage = ({
  user,
  inviteInfo,
}: {
  user: User | null;
  inviteInfo: GetInviteInfoQuery['getInviteInfo'];
}) => {
  const t = useI18n();
  return (
    <AuthPageContainer
      title={t['com.polymind.sent-request-to-join-workspace.title']()}
      subtitle={
        <div className={styles.lineHeight}>
          <Trans
            i18nKey="com.polymind.sent-request-to-join-workspace.description"
            components={{
              1: (
                <div className={styles.avatarWrapper}>
                  <Avatar
                    url={`data:image/png;base64,${inviteInfo.workspace.avatar}`}
                    name={inviteInfo.workspace.name}
                    size={20}
                    colorfulFallback
                  />
                </div>
              ),
              2: <span className={styles.inviteName} />,
              3: <span className={styles.inviteName} />,
            }}
            values={{
              workspaceName: inviteInfo.workspace.name,
              userEmail: user?.email,
            }}
          />
        </div>
      }
    ></AuthPageContainer>
  );
};
