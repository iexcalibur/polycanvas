import { NoPageRootError } from '@polycanvas/core/blockmind/block-suite-editor/no-page-error';
import { useI18n } from '@polycanvas/i18n';

import { ContactUS, ErrorDetail } from '../error-basic/error-detail';
import { createErrorFallback } from '../error-basic/fallback-creator';

export const NoPageRootFallback = createErrorFallback(
  NoPageRootError,
  props => {
    const { resetError } = props;
    const t = useI18n();

    return (
      <ErrorDetail
        title={t['com.polymind.error.no-page-root.title']()}
        description={<ContactUS />}
        resetError={resetError}
      />
    );
  }
);
