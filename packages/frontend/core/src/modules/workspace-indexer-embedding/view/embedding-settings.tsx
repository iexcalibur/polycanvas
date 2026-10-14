import { Switch } from '@polycanvas/component';
import {
  SettingHeader,
  SettingRow,
  SettingWrapper,
} from '@polycanvas/component/setting-components';
import { useService } from '@toeverything/infra';
import { useCallback, useState } from 'react';

import { EmbeddingService } from '../services/embedding';

export const EmbeddingSettings = () => {
  const embeddingService = useService(EmbeddingService);
  const [enabled, setEnabled] = useState(false);

  const handleToggle = useCallback(
    (checked: boolean) => {
      setEnabled(checked);
      embeddingService.embeddingEnabled.setEnabled(checked).catch(() => {
        setEnabled(!checked);
      });
    },
    [embeddingService]
  );

  return (
    <>
      <SettingHeader
        title="Embedding"
        subtitle="Allow AI to index and retrieve your content using your API key"
      />
      <SettingWrapper title="">
        <SettingRow
          name="Enable Embedding"
          desc="When enabled, AI can search and reference your documents for better answers"
        >
          <Switch checked={enabled} onChange={handleToggle} />
        </SettingRow>
      </SettingWrapper>
    </>
  );
};
