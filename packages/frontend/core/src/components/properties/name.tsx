import type { DocCustomPropertyInfo } from '@polycanvas/core/modules/db';
import { useI18n } from '@polycanvas/i18n';

import { WorkspacePropertyTypes } from '../workspace-property-types';

export const WorkspacePropertyName = ({
  propertyInfo,
}: {
  propertyInfo: DocCustomPropertyInfo;
}) => {
  const t = useI18n();
  const type = WorkspacePropertyTypes[propertyInfo.type];
  return propertyInfo.name || (type?.name ? t.t(type.name) : t['unnamed']());
};
