import type * as Effect from '@blockmind/polymind/effects';
import type { EditorHost } from '@blockmind/polymind/std';
import type { Store, Transformer, Workspace } from '@blockmind/polymind/store';
import type { TestPolymindEditorContainer } from '@blockmind/integration-test';

declare type _GLOBAL_ = typeof Effect;

declare global {
  interface Window {
    /** Available on playground window
     * the following instance are initialized in `packages/playground/apps/starter/main.ts`
     */
    $blocksuite: {
      store: typeof import('@blockmind/polymind/store');
      blocks: {
        database: typeof import('@blockmind/polymind/blocks/database');
        note: typeof import('@blockmind/polymind/blocks/note');
      };
      global: {
        utils: typeof import('@blockmind/polymind/global/utils');
      };
      services: typeof import('@blockmind/polymind/shared/services');
      editor: typeof import('@blockmind/integration-test');
      blockStd: typeof import('@blockmind/polymind/std');
      polymindModel: typeof import('@blockmind/polymind-model');
    };
    collection: Workspace;
    doc: Store;
    editor: TestPolymindEditorContainer;
    host: EditorHost;
    job: Transformer;
  }
}
