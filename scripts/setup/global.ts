import { setupGlobal } from '@polycanvas/env/global';
import { getBuildConfig } from '@polycanvas-tools/utils/build-config';
import { Package } from '@polycanvas-tools/utils/workspace';

globalThis.BUILD_CONFIG = getBuildConfig(new Package('@polycanvas/web'), {
  mode: 'development',
  channel: 'canary',
});

if (typeof window !== 'undefined') {
  window.location.search = '?prefixUrl=http://127.0.0.1:3010/';
}

setupGlobal();
