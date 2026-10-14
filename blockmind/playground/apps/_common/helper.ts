import { TestWorkspace } from '@blockmind/polymind/store/test';
import { getTestStoreManager } from '@blockmind/integration-test/store';

export function createEmptyDoc() {
  const collection = new TestWorkspace();
  collection.storeExtensions = getTestStoreManager().get('store');
  collection.meta.initialize();
  const doc = collection.createDoc();
  const store = doc.getStore();

  return {
    doc,
    init() {
      doc.load();
      const rootId = store.addBlock('polymind:page', {});
      store.addBlock('polymind:surface', {}, rootId);
      const noteId = store.addBlock('polymind:note', {}, rootId);
      store.addBlock('polymind:paragraph', {}, noteId);
      return store;
    },
  };
}
