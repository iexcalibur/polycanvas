import { POLYMIND_LINKED_DOC_WIDGET } from './config.js';
import { ImportDoc } from './import-doc/import-doc.js';
import { Loader } from './import-doc/loader.js';
import { PolymindLinkedDocWidget } from './index.js';
import { LinkedDocPopover } from './linked-doc-popover.js';
import { PolymindMobileLinkedDocMenu } from './mobile-linked-doc-menu.js';

export function effects() {
  customElements.define('polymind-linked-doc-popover', LinkedDocPopover);
  customElements.define(POLYMIND_LINKED_DOC_WIDGET, PolymindLinkedDocWidget);
  customElements.define('import-doc', ImportDoc);
  customElements.define(
    'polymind-mobile-linked-doc-menu',
    PolymindMobileLinkedDocMenu
  );
  customElements.define('loader-element', Loader);
}
