import { generateUrl } from '@polycanvas/core/components/hooks/polymind/use-share-url';
import { resolveLinkToDoc } from '@polycanvas/core/modules/navigation/utils';
import { WorkspaceService } from '@polycanvas/core/modules/workspace';
import { type ReferenceParams } from '@blockmind/polymind/model';
import {
  GenerateDocUrlExtension,
  ParseDocUrlExtension,
} from '@blockmind/polymind/shared/services';
import type { FrameworkProvider } from '@toeverything/infra';

function patchParseDocUrlExtension(framework: FrameworkProvider) {
  const workspaceService = framework.get(WorkspaceService);
  const baseUrl = location.origin;
  const ParseDocUrl = ParseDocUrlExtension({
    parseDocUrl(url) {
      const info = resolveLinkToDoc(url, baseUrl);
      if (!info || info.workspaceId !== workspaceService.workspace.id) return;

      delete info.refreshKey;

      return info;
    },
  });

  return ParseDocUrl;
}

function patchGenerateDocUrlExtension(framework: FrameworkProvider) {
  const workspaceService = framework.get(WorkspaceService);
  const baseUrl = location.origin;
  const GenerateDocUrl = GenerateDocUrlExtension({
    generateDocUrl(pageId: string, params?: ReferenceParams) {
      return generateUrl({
        ...params,
        pageId,
        workspaceId: workspaceService.workspace.id,
        baseUrl,
      });
    },
  });

  return GenerateDocUrl;
}

export function patchDocUrlExtensions(framework: FrameworkProvider) {
  return [
    patchParseDocUrlExtension(framework),
    patchGenerateDocUrlExtension(framework),
  ];
}
