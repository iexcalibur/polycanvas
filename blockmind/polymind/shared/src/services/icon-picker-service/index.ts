import type { UniComponent } from '@blockmind/polymind-shared/types';
import { createIdentifier } from '@blockmind/global/di';
export enum IconType {
  Emoji = 'emoji',
  PolymindIcon = 'polymind-icon',
  Blob = 'blob',
}

export type IconData =
  | {
      type: IconType.Emoji;
      unicode: string;
    }
  | {
      type: IconType.PolymindIcon;
      name: string;
      color: string;
    }
  | {
      type: IconType.Blob;
      blob: Blob;
    };

export interface IconPickerService {
  iconPickerComponent: UniComponent<{ onSelect?: (data?: IconData) => void }>;
}

export const IconPickerServiceIdentifier =
  createIdentifier<IconPickerService>('IconPickerService');
