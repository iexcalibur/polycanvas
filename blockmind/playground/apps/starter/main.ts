import '../../style.css';

import * as databaseBlocks from '@blockmind/polymind/blocks/database';
import * as noteBlocks from '@blockmind/polymind/blocks/note';
import * as globalUtils from '@blockmind/polymind/global/utils';
import * as services from '@blockmind/polymind/shared/services';
import * as blockStd from '@blockmind/polymind/std';
import * as store from '@blockmind/polymind/store';
import * as polymindModel from '@blockmind/polymind-model';
import * as editor from '@blockmind/integration-test';
import { effects as itEffects } from '@blockmind/integration-test/effects';
import { getTestStoreManager } from '@blockmind/integration-test/store';

import { setupEdgelessTemplate } from '../_common/setup.js';
import { effects as commentEffects } from '../comment/effects.js';
import {
  createStarterDocCollection,
  initStarterDocCollection,
} from './utils/collection.js';
import { mountDefaultDocEditor } from './utils/setup-playground';
import { prepareTestApp } from './utils/test';

itEffects();
const storeManager = getTestStoreManager();
commentEffects();

async function main() {
  if (window.collection) return;

  setupEdgelessTemplate();

  const params = new URLSearchParams(location.search);
  const room = params.get('room') ?? Math.random().toString(16).slice(2, 8);
  const isE2E = room.startsWith('playwright');
  const collection = createStarterDocCollection(storeManager);

  if (isE2E) {
    Object.defineProperty(window, '$blockmind', {
      value: Object.freeze({
        store,
        blocks: {
          database: databaseBlocks,
          note: noteBlocks,
        },
        global: { utils: globalUtils },
        services,
        editor,
        blockStd: blockStd,
        polymindModel: polymindModel,
      }),
    });
    await prepareTestApp(collection);

    return;
  }

  await initStarterDocCollection(collection);
  await mountDefaultDocEditor(collection);
}

main().catch(console.error);
