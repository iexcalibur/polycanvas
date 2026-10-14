import { AtMenuConfigService } from '@polycanvas/core/modules/at-menu-config/services';
import type { LinkedWidgetConfig } from '@blockmind/polymind/widgets/linked-doc';
import { type FrameworkProvider } from '@toeverything/infra';

export function createLinkedWidgetConfig(
  framework: FrameworkProvider
): Partial<LinkedWidgetConfig> | undefined {
  const service = framework.getOptional(AtMenuConfigService);
  if (!service) return;
  return service.getConfig();
}
