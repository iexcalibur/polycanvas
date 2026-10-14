import { editorEffects } from '@polycanvas/core/blockmind/editors';

import { registerTemplates } from './register-templates';

editorEffects();
registerTemplates();

export * from './blockmind-editor';
