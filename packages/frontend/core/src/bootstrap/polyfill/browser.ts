// Patch customElements.define to prevent duplicate registration errors from third-party libraries
// Guard check: customElements is not available in Worker/SharedWorker contexts
if (typeof customElements !== 'undefined') {
  const originalDefine = customElements.define.bind(customElements);
  customElements.define = (name: string, constructor: CustomElementConstructor, options?: ElementDefinitionOptions) => {
    if (!customElements.get(name)) {
      originalDefine(name, constructor, options);
    }
  };
}

import './array';
import './set';
import './dispose';
import './iterator-helpers';
import './promise-with-resolvers';
import './request-idle-callback';
import './resize-observer';
