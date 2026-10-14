import { correctNumberedListsOrderToPrev } from '@blockmind/polymind-block-list';
import { ListBlockModel } from '@blockmind/polymind-model';
import { matchModels } from '@blockmind/polymind-shared/utils';
import type { BlockStdScope } from '@blockmind/std';
import type { TransformerMiddleware } from '@blockmind/store';

export const reorderList =
  (std: BlockStdScope): TransformerMiddleware =>
  ({ slots }) => {
    const afterImportBlockSubscription = slots.afterImport.subscribe(
      payload => {
        if (payload.type === 'block') {
          const model = payload.model;
          if (
            matchModels(model, [ListBlockModel]) &&
            model.props.type === 'numbered'
          ) {
            const next = std.store.getNext(model);
            correctNumberedListsOrderToPrev(std.store, model);
            if (next) {
              correctNumberedListsOrderToPrev(std.store, next);
            }
          }
        }
      }
    );

    return () => {
      afterImportBlockSubscription.unsubscribe();
    };
  };
