import { PolymindSchemas } from '@blockmind/polymind/schemas';
import { Schema, Text, type Workspace } from '@blockmind/polymind/store';
import { ZipTransformer } from '@blockmind/polymind/widgets/linked-doc';
export async function polymindSnapshot(collection: Workspace, id: string) {
  const doc = collection.createDoc(id);
  doc.load();
  const store = doc.getStore();
  // Add root block and surface block at root level
  const rootId = store.addBlock('polymind:page', {
    title: new Text('Polymind Snapshot Test'),
  });
  store.addBlock('polymind:surface', {}, rootId);

  const path = '/apps/starter/data/snapshots/polymind-default.zip';
  const response = await fetch(path);
  const file = await response.blob();
  const schema = new Schema();
  schema.register(PolymindSchemas);
  await ZipTransformer.importDocs(collection, schema, file);
}

polymindSnapshot.id = 'polymind-snapshot';
polymindSnapshot.displayName = 'Polymind Snapshot Test';
polymindSnapshot.description = 'Polymind Snapshot Test';
