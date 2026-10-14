import type { EditorHost } from '@blockmind/std';

export function isInsidePageEditor(host?: EditorHost) {
  if (!host) return false;
  return Array.from(host.children).some(
    v => v.tagName.toLowerCase() === 'polymind-page-root'
  );
}

export function isInsideEdgelessEditor(host?: EditorHost) {
  if (!host) return false;

  return Array.from(host.children).some(
    v =>
      v.tagName.toLowerCase() === 'polymind-edgeless-root' ||
      v.tagName.toLowerCase() === 'polymind-edgeless-root-preview'
  );
}
