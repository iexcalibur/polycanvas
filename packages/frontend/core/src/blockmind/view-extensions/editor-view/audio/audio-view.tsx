import type { ReactToLit } from '@polycanvas/component';
import { AttachmentEmbedPreview } from '@polycanvas/core/blockmind/attachment-viewer/attachment-embed-preview';
import { AttachmentEmbedConfigIdentifier } from '@blockmind/polymind/blocks/attachment';
import type { ExtensionType } from '@blockmind/store';

export function patchForAudioEmbedView(reactToLit: ReactToLit): ExtensionType {
  return {
    setup: di => {
      // do not show audio block on mobile
      if (BUILD_CONFIG.isMobileEdition) {
        return;
      }
      di.override(AttachmentEmbedConfigIdentifier('audio'), () => ({
        name: 'audio',
        check: (model, maxFileSize) =>
          model.props.type.startsWith('audio/') &&
          model.props.size <= maxFileSize,
        render: (model, _) =>
          reactToLit(<AttachmentEmbedPreview model={model} />, false),
      }));
    },
  };
}
