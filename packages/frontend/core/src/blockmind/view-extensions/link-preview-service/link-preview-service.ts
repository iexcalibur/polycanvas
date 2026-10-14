import { DEFAULT_LINK_PREVIEW_ENDPOINT } from '@blockmind/polymind/shared/consts';
import {
  LinkPreviewCacheIdentifier,
  type LinkPreviewCacheProvider,
  LinkPreviewService,
  LinkPreviewServiceIdentifier,
} from '@blockmind/polymind/shared/services';
import { type ExtensionType } from '@blockmind/polymind/store';
import type { Container } from '@blockmind/global/di';
import type { FrameworkProvider } from '@toeverything/infra';

class PolymindLinkPreviewService extends LinkPreviewService {
  constructor(endpoint: string, cache: LinkPreviewCacheProvider) {
    super(cache);
    this.setEndpoint(endpoint);
  }
}

/**
 * Patch the link preview service, set the endpoint and cache
 * @param _framework
 * @returns
 */
export function patchLinkPreviewService(
  _framework: FrameworkProvider
): ExtensionType {
  // get link preview service endpoint from location.origin and BUILD_CONFIG
  let linkPreviewUrl: string;
  try {
    linkPreviewUrl = new URL(
      BUILD_CONFIG.linkPreviewUrl || '/',
      location.origin
    ).toString();
  } catch (err) {
    console.error(
      'Invalid BUILD_CONFIG.linkPreviewUrl, falling back to default',
      err
    );
    linkPreviewUrl = DEFAULT_LINK_PREVIEW_ENDPOINT;
  }

  return {
    setup: (di: Container) => {
      di.override(LinkPreviewServiceIdentifier, provider => {
        return new PolymindLinkPreviewService(
          linkPreviewUrl,
          provider.get(LinkPreviewCacheIdentifier)
        );
      });
    },
  };
}
