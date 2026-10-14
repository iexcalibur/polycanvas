import { EditPropsStore } from '@blockmind/polymind-shared/services';
import {
  type SurfaceMiddleware,
  SurfaceMiddlewareBuilder,
} from '@blockmind/std/gfx';

import { getLastPropsKey } from '../utils';

export class EditPropsMiddlewareBuilder extends SurfaceMiddlewareBuilder {
  static override key = 'editProps';

  middleware: SurfaceMiddleware = ctx => {
    if (ctx.type === 'beforeAdd') {
      const { type, props } = ctx.payload;
      const key = getLastPropsKey(type, props);
      const nProps = key
        ? this.std.get(EditPropsStore).applyLastProps(key, ctx.payload.props)
        : null;

      ctx.payload.props = {
        ...(nProps ?? props),
        index: props.index ?? this.gfx.layer.generateIndex(),
      };
    }
  };
}
