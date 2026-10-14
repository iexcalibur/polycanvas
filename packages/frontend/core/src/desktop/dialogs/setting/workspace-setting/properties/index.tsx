import { Button, Menu } from '@polycanvas/component';
import { SettingHeader } from '@polycanvas/component/setting-components';
import { useWorkspaceInfo } from '@polycanvas/core/components/hooks/use-workspace-info';
import { WorkspacePropertyManager } from '@polycanvas/core/components/properties/manager';
import { CreatePropertyMenuItems } from '@polycanvas/core/components/properties/menu/create-doc-property';
import type { DocCustomPropertyInfo } from '@polycanvas/core/modules/db';
import { WorkspaceService } from '@polycanvas/core/modules/workspace';
import { Trans, useI18n } from '@polycanvas/i18n';
import { FrameworkScope, useService } from '@toeverything/infra';
import { useCallback } from 'react';

import * as styles from './styles.css';

const WorkspaceSettingPropertiesMain = () => {
  const t = useI18n();

  const onCreated = useCallback((_property: DocCustomPropertyInfo) => {}, []);

  const onPropertyInfoChange = useCallback(
    (_property: DocCustomPropertyInfo, _field: string) => {},
    []
  );

  return (
    <div className={styles.main}>
      <div className={styles.listHeader}>
        <Menu items={<CreatePropertyMenuItems onCreated={onCreated} />}>
          <Button variant="primary">
            {t['com.polymind.settings.workspace.properties.add_property']()}
          </Button>
        </Menu>
      </div>
      <WorkspacePropertyManager onPropertyInfoChange={onPropertyInfoChange} />
    </div>
  );
};

export const WorkspaceSettingProperties = () => {
  const t = useI18n();
  const workspace = useService(WorkspaceService).workspace;
  const workspaceInfo = useWorkspaceInfo(workspace);
  const title = workspaceInfo?.name || 'untitled';

  if (workspace === null) {
    return null;
  }

  return (
    <FrameworkScope scope={workspace.scope}>
      <SettingHeader
        title={t['com.polymind.settings.workspace.properties.header.title']()}
        subtitle={
          <Trans
            values={{
              name: title,
            }}
            i18nKey="com.polymind.settings.workspace.properties.header.subtitle"
          >
            Manage workspace <strong>name</strong> properties
          </Trans>
        }
      />
      <WorkspaceSettingPropertiesMain />
    </FrameworkScope>
  );
};
