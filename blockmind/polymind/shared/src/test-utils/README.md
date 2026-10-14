# PolyMind Test Tools

## Structured Document Creation

`polymind-template.ts` provides a concise way to create test documents, using a html-like syntax.

### Basic Usage

```typescript
import { polymind } from '@blockmind/polymind-shared/test-utils';

// Create a simple document
const doc = polymind`
  <polymind-page>
    <polymind-note>
      <polymind-paragraph>Hello, World!</polymind-paragraph>
    </polymind-note>
  </polymind-page>
`;
```

### Complex Structure Example

```typescript
// Create a document with multiple notes and paragraphs
const doc = polymind`
  <polymind-page title="My Test Page">
    <polymind-note>
      <polymind-paragraph>First paragraph</polymind-paragraph>
      <polymind-paragraph>Second paragraph</polymind-paragraph>
    </polymind-note>
    <polymind-note>
      <polymind-paragraph>Another note</polymind-paragraph>
    </polymind-note>
  </polymind-page>
`;
```

### Application in Tests

This tool is particularly suitable for creating documents with specific structures in test cases:

```typescript
import { describe, expect, it } from 'vitest';
import { polymind } from '../__tests__/utils/polymind-template';

describe('My Test', () => {
  it('should correctly handle document structure', () => {
    const doc = polymind`
      <polymind-page>
        <polymind-note>
          <polymind-paragraph>Test content</polymind-paragraph>
        </polymind-note>
      </polymind-page>
    `;

    // Get blocks
    const pages = doc.getBlocksByFlavour('polymind:page');
    const notes = doc.getBlocksByFlavour('polymind:note');
    const paragraphs = doc.getBlocksByFlavour('polymind:paragraph');

    expect(pages.length).toBe(1);
    expect(notes.length).toBe(1);
    expect(paragraphs.length).toBe(1);

    // Perform more tests here...
  });
});
```

### Supported Block Types

Currently supports the following block types:

- `polymind-page` → `polymind:page`
- `polymind-note` → `polymind:note`
- `polymind-paragraph` → `polymind:paragraph`
- `polymind-list` → `polymind:list`
- `polymind-image` → `polymind:image`
