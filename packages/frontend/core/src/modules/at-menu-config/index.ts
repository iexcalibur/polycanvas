import { type Framework } from '@toeverything/infra';

import { WorkspaceDialogService } from '../dialogs';
import { DocScope, DocsService } from '../doc';
import { GuardService, MemberSearchService } from '../permissions';
import { DocGrantedUsersService } from '../permissions/services/doc-granted-users';
import { SearchMenuService } from '../search-menu/services';
import { WorkspaceScope } from '../workspace';
import { AtMenuConfigService } from './services';

export function configAtMenuConfigModule(framework: Framework) {
  framework
    .scope(WorkspaceScope)
    .scope(DocScope)
    .service(AtMenuConfigService, [
      WorkspaceDialogService,
      DocsService,
      SearchMenuService,
      MemberSearchService,
      GuardService,
      DocGrantedUsersService,
    ]);
}
