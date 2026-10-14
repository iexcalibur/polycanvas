import { type Framework } from '@toeverything/infra';

import { DocsService } from '../doc';
import { ExplorerIconService } from '../explorer-icon/services/explorer-icon';
import { I18nService } from '../i18n';
import { WorkspaceScope } from '../workspace';
import { DocDisplayMetaService } from './services/doc-display-meta';

export { DocDisplayMetaService };

export function configureDocDisplayMetaModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .service(DocDisplayMetaService, [
      DocsService,
      I18nService,
      ExplorerIconService,
    ]);
}
