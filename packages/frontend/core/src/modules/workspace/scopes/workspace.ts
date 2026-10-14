import type { WorkerInitOptions } from '@polycanvas/nbstore/worker/client';
import { Scope } from '@toeverything/infra';

import type { WorkspaceOpenOptions } from '../open-options';

export class WorkspaceScope extends Scope<{
  openOptions: WorkspaceOpenOptions;
  engineWorkerInitOptions: WorkerInitOptions;
}> {}
