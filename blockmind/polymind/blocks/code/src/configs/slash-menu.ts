import { type SlashMenuConfig } from '@blockmind/polymind-widget-slash-menu';

export const codeSlashMenuConfig: SlashMenuConfig = {
  disableWhen: ({ model }) => {
    return model.flavour === 'polymind:code';
  },
  items: [],
};
