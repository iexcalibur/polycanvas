import type { SurfaceBlockModel } from '@blockmind/polymind-block-surface';
import type { ConnectorElementModel } from '@blockmind/polymind-model';
import type { IVec, SerializedXYWH } from '@blockmind/global/gfx';
import { assertType } from '@blockmind/global/utils';
import type { BlockStdScope } from '@blockmind/std';
import {
  GfxController,
  type GfxModel,
  isGfxGroupCompatibleModel,
} from '@blockmind/std/gfx';
import type { TransformerMiddleware } from '@blockmind/store';

/**
 * Used to filter out gfx elements that are not selected
 * @param ids
 * @param std
 * @returns
 */
export const gfxBlocksFilter = (
  ids: string[],
  std: BlockStdScope
): TransformerMiddleware => {
  const selectedIds = new Set<string>();
  const store = std.store;
  const surface = store.getBlocksByFlavour('polymind:surface')[0]
    .model as SurfaceBlockModel;
  const idsToCheck = ids.slice();
  const gfx = std.get(GfxController);

  for (const id of idsToCheck) {
    const blockOrElem = store.getBlock(id)?.model ?? surface.getElementById(id);

    if (!blockOrElem) continue;

    if (isGfxGroupCompatibleModel(blockOrElem)) {
      idsToCheck.push(...blockOrElem.childIds);
    }

    selectedIds.add(id);
  }

  return ({ slots, transformerConfigs }) => {
    const beforeExportSubscription = slots.beforeExport.subscribe(payload => {
      if (payload.type !== 'block') {
        return;
      }

      if (payload.model.flavour === 'polymind:surface') {
        transformerConfigs.set('selectedElements', selectedIds);
        payload.model.children = payload.model.children.filter(model =>
          selectedIds.has(model.id)
        );
        return;
      }
    });

    const afterExportSubscription = slots.afterExport.subscribe(payload => {
      if (payload.type !== 'block') {
        return;
      }

      if (payload.model.flavour === 'polymind:surface') {
        const { snapshot } = payload;
        const elementsMap = snapshot.props.elements as Record<
          string,
          { type: string }
        >;

        Object.entries(elementsMap).forEach(([elementId, val]) => {
          if (val.type === 'connector') {
            assertType<{
              type: 'connector';
              source: { position: IVec; id?: string };
              target: { position: IVec; id?: string };
              xywh: SerializedXYWH;
            }>(val);

            const connectorElem = gfx.getElementById(
              elementId
            ) as ConnectorElementModel;

            if (!connectorElem) {
              delete elementsMap[elementId];
              return;
            }

            // should be deleted during the import process
            val.xywh = connectorElem.xywh;

            ['source', 'target'].forEach(key => {
              const endpoint = val[key as 'source' | 'target'];
              if (endpoint.id && !selectedIds.has(endpoint.id)) {
                const endElem = gfx.getElementById(endpoint.id);

                if (!endElem) {
                  delete elementsMap[elementId];
                  return;
                }

                const endElemBound = (endElem as GfxModel).elementBound;

                val[key as 'source' | 'target'] = {
                  position: endElemBound.getRelativePoint(
                    endpoint.position ?? [0.5, 0.5]
                  ),
                };
              }
            });
          }
        });
      }
    });

    return () => {
      beforeExportSubscription.unsubscribe();
      afterExportSubscription.unsubscribe();
    };
  };
};
