/**
 * @vitest-environment happy-dom
 */
import type { TextSelection } from '@blockmind/std';
import { describe, expect, it } from 'vitest';

import { replaceSelectedTextWithBlocksCommand } from '../../../commands/model-crud/replace-selected-text-with-blocks';
import { polymind, block } from '../../../test-utils';

describe('commands/model-crud', () => {
  describe('replaceSelectedTextWithBlocksCommand', () => {
    it('should replace selected text with blocks when both first and last blocks are mergable blocks', () => {
      const host = polymind`
        <polymind-page id="page">
          <polymind-note id="note">
            <polymind-paragraph id="paragraph-1">Hel<anchor />lo</polymind-paragraph>
            <polymind-paragraph id="paragraph-2">Wor<focus />ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const blocks = [
        block`<polymind-paragraph id="111">111</polymind-paragraph>`,
        block`<polymind-code id="code"></polymind-code>`,
        block`<polymind-paragraph id="222">222</polymind-paragraph>`,
      ]
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.model);

      const textSelection = host.selection.value[0] as TextSelection;

      host.command.exec(replaceSelectedTextWithBlocksCommand, {
        textSelection,
        blocks,
      });

      const expected = polymind`
        <polymind-page id="page">
          <polymind-note id="note">
            <polymind-paragraph id="paragraph-1">Hel111</polymind-paragraph>
            <polymind-code id="code"></polymind-code>
            <polymind-paragraph id="paragraph-2">222ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      expect(host.store).toEqualDoc(expected.store);
    });

    it('should replace selected text with blocks when both first and last blocks are mergable blocks in single paragraph', () => {
      const host = polymind`
        <polymind-page id="page">
          <polymind-note id="note">
            <polymind-paragraph id="paragraph-1">Hel<anchor></anchor>lo Wor<focus></focus>ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const blocks = [
        block`<polymind-paragraph id="111">111</polymind-paragraph>`,
        block`<polymind-code id="code"></polymind-code>`,
        block`<polymind-paragraph id="222">222</polymind-paragraph>`,
      ]
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.model);

      const textSelection = host.selection.value[0] as TextSelection;

      host.command.exec(replaceSelectedTextWithBlocksCommand, {
        textSelection,
        blocks,
      });

      const expected = polymind`
        <polymind-page id="page">
          <polymind-note id="note">
            <polymind-paragraph id="paragraph-1">Hel111</polymind-paragraph>
            <polymind-code id="code"></polymind-code>
            <polymind-paragraph id="222">222ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      expect(host.store).toEqualDoc(expected.store);
    });

    it('should replace selected text with blocks when blocks contains only one mergable block', () => {
      const host = polymind`
        <polymind-page id="page">
          <polymind-note id="note">
            <polymind-paragraph id="paragraph-1">Hel<anchor />lo</polymind-paragraph>
            <polymind-paragraph id="paragraph-2">Wor<focus />ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const blocks = [block`<polymind-paragraph id="111">111</polymind-paragraph>`]
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.model);

      const textSelection = host.selection.value[0] as TextSelection;

      host.command.exec(replaceSelectedTextWithBlocksCommand, {
        textSelection,
        blocks,
      });

      const expected = polymind`
        <polymind-page id="page">
          <polymind-note id="note">
            <polymind-paragraph id="paragraph-1">Hel111ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      expect(host.store).toEqualDoc(expected.store);
    });

    it('should replace selected text with blocks when blocks contains only one mergable block in single paragraph', () => {
      const host = polymind`
        <polymind-page id="page">
          <polymind-note id="note">
            <polymind-paragraph id="paragraph-1">Hel<anchor></anchor>lo Wor<focus></focus>ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const blocks = [block`<polymind-paragraph id="111">111</polymind-paragraph>`]
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.model);

      const textSelection = host.selection.value[0] as TextSelection;

      host.command.exec(replaceSelectedTextWithBlocksCommand, {
        textSelection,
        blocks,
      });

      const expected = polymind`
        <polymind-page id="page">
          <polymind-note id="note">
            <polymind-paragraph id="paragraph-1">Hel111ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      expect(host.store).toEqualDoc(expected.store);
    });

    it('should replace selected text with blocks when only first block is mergable block', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note>
            <polymind-paragraph>Hel<anchor />lo</polymind-paragraph>
            <polymind-paragraph>Wor<focus />ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const blocks = [
        block`<polymind-paragraph>111</polymind-paragraph>`,
        block`<polymind-code></polymind-code>`,
        block`<polymind-code></polymind-code>`,
      ]
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.model);

      const textSelection = host.selection.value[0] as TextSelection;

      host.command.exec(replaceSelectedTextWithBlocksCommand, {
        textSelection,
        blocks,
      });

      const expected = polymind`
        <polymind-page>
          <polymind-note >
            <polymind-paragraph>Hel111</polymind-paragraph>
            <polymind-code></polymind-code>
            <polymind-code></polymind-code>
            <polymind-paragraph>ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      expect(host.store).toEqualDoc(expected.store);
    });

    it('should replace selected text with blocks when only first block is mergable block in single paragraph', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note>
            <polymind-paragraph>Hel<anchor></anchor>lo Wor<focus></focus>ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const blocks = [
        block`<polymind-paragraph>111</polymind-paragraph>`,
        block`<polymind-code></polymind-code>`,
        block`<polymind-code></polymind-code>`,
      ]
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.model);

      const textSelection = host.selection.value[0] as TextSelection;

      host.command.exec(replaceSelectedTextWithBlocksCommand, {
        textSelection,
        blocks,
      });

      const expected = polymind`
        <polymind-page>
          <polymind-note>
            <polymind-paragraph>Hel111</polymind-paragraph>
            <polymind-code></polymind-code>
            <polymind-code></polymind-code>
            <polymind-paragraph>ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      expect(host.store).toEqualDoc(expected.store);
    });

    it('should replace selected text with blocks when only last block is mergable block', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note>
            <polymind-paragraph>Hel<anchor />lo</polymind-paragraph>
            <polymind-paragraph>Wor<focus />ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const blocks = [
        block`<polymind-code></polymind-code>`,
        block`<polymind-code></polymind-code>`,
        block`<polymind-paragraph>111</polymind-paragraph>`,
      ]
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.model);

      const textSelection = host.selection.value[0] as TextSelection;

      host.command.exec(replaceSelectedTextWithBlocksCommand, {
        textSelection,
        blocks,
      });

      const expected = polymind`
        <polymind-page>
          <polymind-note >
            <polymind-paragraph>Hel</polymind-paragraph>
            <polymind-code></polymind-code>
            <polymind-code></polymind-code>
            <polymind-paragraph>111ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;
      expect(host.store).toEqualDoc(expected.store);
    });

    it('should replace selected text with blocks when only last block is mergable block in single paragraph', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note>
            <polymind-paragraph>Hel<anchor></anchor>lo Wor<focus></focus>ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const blocks = [
        block`<polymind-code></polymind-code>`,
        block`<polymind-code></polymind-code>`,
        block`<polymind-paragraph>111</polymind-paragraph>`,
      ]
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.model);

      const textSelection = host.selection.value[0] as TextSelection;

      host.command.exec(replaceSelectedTextWithBlocksCommand, {
        textSelection,
        blocks,
      });

      const expected = polymind`
        <polymind-page>
          <polymind-note>
            <polymind-paragraph>Hel</polymind-paragraph>
            <polymind-code></polymind-code>
            <polymind-code></polymind-code>
            <polymind-paragraph>111ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;
      expect(host.store).toEqualDoc(expected.store);
    });

    it('should replace selected text with blocks when neither first nor last block is mergable block', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note>
            <polymind-paragraph>Hel<anchor />lo</polymind-paragraph>
            <polymind-paragraph>Wor<focus />ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const blocks = [
        block`<polymind-code></polymind-code>`,
        block`<polymind-code></polymind-code>`,
      ]
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.model);

      const textSelection = host.selection.value[0] as TextSelection;

      host.command.exec(replaceSelectedTextWithBlocksCommand, {
        textSelection,
        blocks,
      });

      const expected = polymind`
        <polymind-page>
          <polymind-note >
            <polymind-paragraph>Hel</polymind-paragraph>
            <polymind-code></polymind-code>
            <polymind-code></polymind-code>
            <polymind-paragraph>ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;
      expect(host.store).toEqualDoc(expected.store);
    });

    it('should replace selected text with blocks when neither first nor last block is mergable block in single paragraph', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note>
            <polymind-paragraph>Hel<anchor></anchor>lo Wor<focus></focus>ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const blocks = [
        block`<polymind-code></polymind-code>`,
        block`<polymind-code></polymind-code>`,
      ]
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.model);

      const textSelection = host.selection.value[0] as TextSelection;

      host.command.exec(replaceSelectedTextWithBlocksCommand, {
        textSelection,
        blocks,
      });

      const expected = polymind`
        <polymind-page>
          <polymind-note>
            <polymind-paragraph>Hel</polymind-paragraph>
            <polymind-code></polymind-code>
            <polymind-code></polymind-code>
            <polymind-paragraph>ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;
      expect(host.store).toEqualDoc(expected.store);
    });

    it('should replace selected text with blocks when both first and last blocks are mergable blocks with different types', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note>
            <polymind-paragraph>Hel<anchor />lo</polymind-paragraph>
            <polymind-paragraph>Wor<focus />ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const blocks = [
        block`<polymind-list>1.</polymind-list>`,
        block`<polymind-list>2.</polymind-list>`,
      ]
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.model);

      const textSelection = host.selection.value[0] as TextSelection;

      host.command.exec(replaceSelectedTextWithBlocksCommand, {
        textSelection,
        blocks,
      });

      const expected = polymind`
        <polymind-page>
          <polymind-note >
            <polymind-paragraph>Hel</polymind-paragraph>
            <polymind-list>1.</polymind-list>
            <polymind-list>2.</polymind-list>
            <polymind-paragraph>ld</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;
      expect(host.store).toEqualDoc(expected.store);
    });

    it('should replace selected text with blocks when both first and last blocks are paragraphs, and cursor is at the end of the text-block with different types', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note>
            <polymind-list>Hel<anchor />lo</polymind-list>
            <polymind-list>Wor<focus />ld</polymind-list>
          </polymind-note>
        </polymind-page>
      `;

      const blocks = [
        block`<polymind-paragraph>111</polymind-paragraph>`,
        block`<polymind-paragraph>222</polymind-paragraph>`,
      ]
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.model);

      const textSelection = host.selection.value[0] as TextSelection;

      host.command.exec(replaceSelectedTextWithBlocksCommand, {
        textSelection,
        blocks,
      });

      const expected = polymind`
        <polymind-page>
          <polymind-note >
            <polymind-list>Hel111</polymind-list>
            <polymind-list>222ld</polymind-list>
          </polymind-note>
        </polymind-page>
      `;
      expect(host.store).toEqualDoc(expected.store);
    });

    it('should replace selected text with blocks when first block is paragraph, and cursor is at the end of the text-block with different type  ', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note>
            <polymind-list>Hel<anchor />lo</polymind-list>
            <polymind-list>Wor<focus />ld</polymind-list>
          </polymind-note>
        </polymind-page>
      `;

      const blocks = [
        block`<polymind-paragraph>111</polymind-paragraph>`,
        block`<polymind-code></polymind-code>`,
      ]
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.model);

      const textSelection = host.selection.value[0] as TextSelection;

      host.command.exec(replaceSelectedTextWithBlocksCommand, {
        textSelection,
        blocks,
      });

      const expected = polymind`
        <polymind-page>
          <polymind-note >
            <polymind-list>Hel111</polymind-list>
            <polymind-code></polymind-code>
            <polymind-list>ld</polymind-list>
          </polymind-note>
        </polymind-page>
      `;
      expect(host.store).toEqualDoc(expected.store);
    });

    it('should replace selected text with blocks when last block is paragraph, and cursor is at the end of the text-block with different type  ', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note>
            <polymind-list>Hel<anchor />lo</polymind-list>
            <polymind-list>Wor<focus />ld</polymind-list>
          </polymind-note>
        </polymind-page>
      `;

      const blocks = [
        block`<polymind-code></polymind-code>`,
        block`<polymind-paragraph>222</polymind-paragraph>`,
      ]
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map(b => b.model);

      const textSelection = host.selection.value[0] as TextSelection;

      host.command.exec(replaceSelectedTextWithBlocksCommand, {
        textSelection,
        blocks,
      });

      const expected = polymind`
        <polymind-page>
          <polymind-note >
            <polymind-list>Hel</polymind-list>
            <polymind-code></polymind-code>
            <polymind-list>222ld</polymind-list>
          </polymind-note>
        </polymind-page>
      `;
      expect(host.store).toEqualDoc(expected.store);
    });
  });
});
