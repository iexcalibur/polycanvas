import type { ReactToLit } from '@polycanvas/component';
import type { PolymindReference } from '@blockmind/polymind/inlines/reference';
import { ReferenceNodeConfigExtension } from '@blockmind/polymind/inlines/reference';
import type { ExtensionType } from '@blockmind/polymind/store';

export type ReferenceReactRenderer = (
  reference: PolymindReference
) => React.ReactElement;

export function patchReferenceRenderer(
  reactToLit: ReactToLit,
  reactRenderer: ReferenceReactRenderer
): ExtensionType {
  const customContent = (reference: PolymindReference) => {
    const node = reactRenderer(reference);
    return reactToLit(node, true);
  };

  return ReferenceNodeConfigExtension({
    customContent,
    hidePopup: BUILD_CONFIG.isMobileEdition,
  });
}
