import { DocsService } from '@polycanvas/core/modules/doc';
import {
  CreationQuickSearchSession,
  DocsQuickSearchSession,
  LinksQuickSearchSession,
  QuickSearchService,
  RecentDocsQuickSearchSession,
} from '@polycanvas/core/modules/quicksearch';
import { ExternalLinksQuickSearchSession } from '@polycanvas/core/modules/quicksearch/impls/external-links';
import {
  BookmarkSlashMenuConfigIdentifier,
  insertLinkByQuickSearchCommand,
} from '@blockmind/polymind/blocks/bookmark';
import { LinkedDocSlashMenuConfigIdentifier } from '@blockmind/polymind/blocks/embed-doc';
import type { ServiceIdentifier } from '@blockmind/polymind/global/di';
import {
  QuickSearchExtension,
  type QuickSearchResult,
} from '@blockmind/polymind/shared/services';
import { type ExtensionType } from '@blockmind/polymind/store';
import type {
  SlashMenuConfig,
  SlashMenuItem,
} from '@blockmind/polymind/widgets/slash-menu';
import type { FrameworkProvider } from '@toeverything/infra';
import { pick } from 'lodash-es';

export function patchQuickSearchService(framework: FrameworkProvider) {
  const QuickSearch = QuickSearchExtension({
    async openQuickSearch() {
      let searchResult: QuickSearchResult = null;
      searchResult = await new Promise(resolve =>
        framework.get(QuickSearchService).quickSearch.show(
          [
            framework.createEntity(RecentDocsQuickSearchSession),
            framework.createEntity(CreationQuickSearchSession),
            framework.createEntity(DocsQuickSearchSession),
            framework.createEntity(LinksQuickSearchSession),
            framework.createEntity(ExternalLinksQuickSearchSession),
          ],
          result => {
            if (result === null) {
              resolve(null);
              return;
            }

            if (result.source === 'docs') {
              resolve({
                docId: result.payload.docId,
              });
              return;
            }

            if (result.source === 'recent-doc') {
              resolve({
                docId: result.payload.docId,
              });
              return;
            }

            if (result.source === 'link') {
              resolve({
                docId: result.payload.docId,
                params: pick(result.payload, [
                  'mode',
                  'blockIds',
                  'elementIds',
                ]),
              });
              return;
            }

            if (result.source === 'external-link') {
              const externalUrl = result.payload.url;
              resolve({ externalUrl });
              return;
            }

            if (result.source === 'creation') {
              const docsService = framework.get(DocsService);
              const newDoc = docsService.createDoc({
                primaryMode: 'edgeless',
                title: result.payload.title,
              });

              resolve({ docId: newDoc.id });
              return;
            }
          },
          {
            label: {
              i18nKey: 'com.polymind.cmdk.insert-links',
            },
            placeholder: {
              i18nKey: 'com.polymind.cmdk.docs.placeholder',
            },
          }
        )
      );

      return searchResult;
    },
  });

  const SlashMenuQuickSearchExtension: ExtensionType = {
    setup: di => {
      const overrideFn = (identifier: ServiceIdentifier<SlashMenuConfig>) => {
        const prev = di.getFactory(identifier);
        if (!prev) return;

        di.override(identifier, provider => {
          const prevConfig: SlashMenuConfig = prev(provider);

          if (typeof prevConfig.items === 'function') {
            const prevConfigItemGenerator = prevConfig.items;
            prevConfig.items = ctx =>
              prevConfigItemGenerator(ctx).map(modifyFn);
          } else {
            prevConfig.items = prevConfig.items.map(modifyFn);
          }

          return prevConfig;
        });
      };

      overrideFn(LinkedDocSlashMenuConfigIdentifier);
      overrideFn(BookmarkSlashMenuConfigIdentifier);

      const modifyFn = (item: SlashMenuItem): SlashMenuItem => {
        if ('action' in item && item.name === 'Link') {
          item.action = ({ std }) => {
            const [success, { insertedLinkType }] = std.command.exec(
              insertLinkByQuickSearchCommand
            );

            if (!success) return;

            insertedLinkType
              ?.then(type => {
                const flavour = type?.flavour;
                if (!flavour) return;

                if (flavour === 'polymind:bookmark') {
                  return;
                }

                if (flavour === 'polymind:embed-linked-doc') {
                  return;
                }
              })
              .catch(console.error);
          };
        }
        return item;
      };
    },
  };

  return [QuickSearch, SlashMenuQuickSearchExtension];
}
