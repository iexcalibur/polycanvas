import { type Framework } from '@toeverything/infra';

import { WorkspaceFlavoursProvider } from '../workspace';
import {
  LocalWorkspaceFlavoursProvider,
  setLocalWorkspaceIds,
} from './impls/local';

export { base64ToUint8Array, uint8ArrayToBase64 } from './utils/base64';

export function configureBrowserWorkspaceFlavours(framework: Framework) {
  framework.impl(
    WorkspaceFlavoursProvider('LOCAL'),
    LocalWorkspaceFlavoursProvider
  );
}

/**
 * a hack for directly add local workspace to workspace list
 * Used after copying sqlite database file to appdata folder
 */
export function _addLocalWorkspace(id: string) {
  setLocalWorkspaceIds(ids => (ids.includes(id) ? ids : [...ids, id]));
}
