import { insertLinkByQuickSearchCommand } from '@blockmind/polymind-block-bookmark';
import { menu } from '@blockmind/polymind-components/context-menu';
import { LinkIcon } from '@blockmind/polymind-components/icons';
import type { DenseMenuBuilder } from '@blockmind/polymind-widget-edgeless-toolbar';

export const buildLinkDenseMenu: DenseMenuBuilder = edgeless =>
  menu.action({
    name: 'Link',
    prefix: LinkIcon,
    select: () => {
      const [_, { insertedLinkType }] = edgeless.std.command.exec(
        insertLinkByQuickSearchCommand
      );

      insertedLinkType
        ?.then(type => {
          const flavour = type?.flavour;
          if (!flavour) return;

          edgeless.std?.track('CanvasElementAdded', {
            control: 'toolbar:general',
            page: 'whiteboard editor',
            module: 'toolbar',
            type: flavour.split(':')[1],
          });
        })
        .catch(console.error);
    },
  });
