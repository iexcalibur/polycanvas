import '@polycanvas/core/bootstrap/electron';
import '@polycanvas/core/bootstrap/cleanup';
import '@polycanvas/component/theme';
import './global.css';

import { apis } from '@polycanvas/electron-api';
import { bindNativeDBApis } from '@polycanvas/nbstore/sqlite';
import { bindNativeDBV1Apis } from '@polycanvas/nbstore/sqlite/v1';

// oxlint-disable-next-line no-non-null-assertion
bindNativeDBApis(apis!.nbstore);
// oxlint-disable-next-line no-non-null-assertion
bindNativeDBV1Apis(apis!.db);
