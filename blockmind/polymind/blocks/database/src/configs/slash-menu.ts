import { getSelectedModelsCommand } from '@blockmind/polymind-shared/commands';
import { isInsideBlockByFlavour } from '@blockmind/polymind-shared/utils';
import { type SlashMenuConfig } from '@blockmind/polymind-widget-slash-menu';
import { viewPresets } from '@blockmind/data-view/view-presets';
import {
  DatabaseKanbanViewIcon,
  DatabaseTableViewIcon,
} from '@blocksuite/icons/lit';

import { insertDatabaseBlockCommand } from '../commands';
import { KanbanViewTooltip, TableViewTooltip } from './tooltips';

export const databaseSlashMenuConfig: SlashMenuConfig = {
  disableWhen: ({ model }) => model.flavour === 'polymind:database',
  items: [
    {
      name: 'Table View',
      description: 'Display items in a table format.',
      searchAlias: ['database'],
      icon: DatabaseTableViewIcon(),
      tooltip: {
        figure: TableViewTooltip,
        caption: 'Table View',
      },
      group: '7_Database@0',
      when: ({ model }) =>
        !isInsideBlockByFlavour(model.store, model, 'polymind:edgeless-text'),
      action: ({ std }) => {
        std.command
          .chain()
          .pipe(getSelectedModelsCommand)
          .pipe(insertDatabaseBlockCommand, {
            viewType: viewPresets.tableViewMeta.type,
            place: 'after',
            removeEmptyLine: true,
          })
          .pipe(({ insertedDatabaseBlockId }) => {
            void insertedDatabaseBlockId;
          })
          .run();
      },
    },

    {
      name: 'Kanban View',
      description: 'Visualize data in a dashboard.',
      searchAlias: ['database'],
      icon: DatabaseKanbanViewIcon(),
      tooltip: {
        figure: KanbanViewTooltip,
        caption: 'Kanban View',
      },
      group: '7_Database@2',
      when: ({ model }) =>
        !isInsideBlockByFlavour(model.store, model, 'polymind:edgeless-text'),
      action: ({ std }) => {
        std.command
          .chain()
          .pipe(getSelectedModelsCommand)
          .pipe(insertDatabaseBlockCommand, {
            viewType: viewPresets.kanbanViewMeta.type,
            place: 'after',
            removeEmptyLine: true,
          })
          .pipe(({ insertedDatabaseBlockId }) => {
            void insertedDatabaseBlockId;
          })
          .run();
      },
    },
  ],
};
