import { builtInTemplates as builtInEdgelessTemplates } from '@polycanvas/templates/edgeless';
import { builtInTemplates as builtInStickersTemplates } from '@polycanvas/templates/stickers';
import {
  EdgelessTemplatePanel,
  type TemplateManager,
} from '@blockmind/polymind/gfx/template';

export function registerTemplates() {
  EdgelessTemplatePanel.templates.extend(
    builtInStickersTemplates as TemplateManager
  );
  EdgelessTemplatePanel.templates.extend(
    builtInEdgelessTemplates as TemplateManager
  );
}
