import { TextSelection } from '@blockmind/std';
import { describe, expect, it } from 'vitest';

import { polymind } from '../../test-utils';

describe('helpers/polymind-template', () => {
  it('should create a basic document structure from template', () => {
    const host = polymind`
      <polymind-page id="page">
        <polymind-note id="note">
          <polymind-paragraph id="paragraph-1">Hello, world</polymind-paragraph>
        </polymind-note>
      </polymind-page>
    `;

    expect(host.store).toBeDefined();

    const pageBlock = host.store.getBlock('page');
    expect(pageBlock).toBeDefined();
    expect(pageBlock?.flavour).toBe('polymind:page');

    const noteBlock = host.store.getBlock('note');
    expect(noteBlock).toBeDefined();
    expect(noteBlock?.flavour).toBe('polymind:note');

    const paragraphBlock = host.store.getBlock('paragraph-1');
    expect(paragraphBlock).toBeDefined();
    expect(paragraphBlock?.flavour).toBe('polymind:paragraph');
  });

  it('should handle nested blocks correctly', () => {
    const host = polymind`
      <polymind-page>
        <polymind-note>
          <polymind-paragraph>First paragraph</polymind-paragraph>
          <polymind-list>List item</polymind-list>
          <polymind-paragraph>Second paragraph</polymind-paragraph>
        </polymind-note>
      </polymind-page>
    `;

    const noteBlocks = host.store.getBlocksByFlavour('polymind:note');
    const paragraphBlocks = host.store.getBlocksByFlavour('polymind:paragraph');
    const listBlocks = host.store.getBlocksByFlavour('polymind:list');

    expect(noteBlocks.length).toBe(1);
    expect(paragraphBlocks.length).toBe(2);
    expect(listBlocks.length).toBe(1);

    const noteBlock = noteBlocks[0];
    const noteChildren =
      host.store.getBlock(noteBlock.id)?.model.children || [];
    expect(noteChildren.length).toBe(3);

    expect(noteChildren[0].flavour).toBe('polymind:paragraph');
    expect(noteChildren[1].flavour).toBe('polymind:list');
    expect(noteChildren[2].flavour).toBe('polymind:paragraph');
  });

  it('should handle empty blocks correctly', () => {
    const host = polymind`
      <polymind-page>
        <polymind-note>
          <polymind-paragraph></polymind-paragraph>
        </polymind-note>
      </polymind-page>
    `;

    const paragraphBlocks = host.store.getBlocksByFlavour('polymind:paragraph');
    expect(paragraphBlocks.length).toBe(1);

    const paragraphBlock = host.store.getBlock(paragraphBlocks[0].id);
    const paragraphText = paragraphBlock?.model.text?.toString() || '';
    expect(paragraphText).toBe('');
  });

  it('should throw error on invalid template', () => {
    expect(() => {
      polymind`
        <unknown-tag></unknown-tag>
      `;
    }).toThrow();
  });

  it('should handle text selection with anchor and focus', () => {
    const host = polymind`
      <polymind-page id="page">
        <polymind-note id="note">
          <polymind-paragraph id="paragraph-1">Hel<anchor />lo</polymind-paragraph>
          <polymind-paragraph id="paragraph-2">Wo<focus />rld</polymind-paragraph>
        </polymind-note>
      </polymind-page>
    `;

    const selection = host.selection.value[0] as TextSelection;
    expect(selection).toBeDefined();
    expect(selection.is(TextSelection)).toBe(true);
    expect(selection.from.blockId).toBe('paragraph-1');
    expect(selection.from.index).toBe(3);
    expect(selection.from.length).toBe(2);
    expect(selection.to?.blockId).toBe('paragraph-2');
    expect(selection.to?.index).toBe(0);
    expect(selection.to?.length).toBe(2);
  });

  it('should handle cursor position', () => {
    const host = polymind`
      <polymind-page id="page">
        <polymind-note id="note">
          <polymind-paragraph id="paragraph-1">Hello<cursor />World</polymind-paragraph>
        </polymind-note>
      </polymind-page>
    `;

    const selection = host.selection.value[0] as TextSelection;
    expect(selection).toBeDefined();
    expect(selection.is(TextSelection)).toBe(true);
    expect(selection.from.blockId).toBe('paragraph-1');
    expect(selection.from.index).toBe(5);
    expect(selection.from.length).toBe(0);
    expect(selection.to).toBeNull();
  });

  it('should handle selection in empty blocks', () => {
    const host = polymind`
      <polymind-page id="page">
        <polymind-note id="note">
          <polymind-paragraph id="paragraph-1"><cursor /></polymind-paragraph>
        </polymind-note>
      </polymind-page>
    `;

    const selection = host.selection.value[0] as TextSelection;
    expect(selection).toBeDefined();
    expect(selection.is(TextSelection)).toBe(true);
    expect(selection.from.blockId).toBe('paragraph-1');
    expect(selection.from.index).toBe(0);
    expect(selection.from.length).toBe(0);
    expect(selection.to).toBeNull();
  });

  it('should handle single point selection', () => {
    const host = polymind`
      <polymind-page id="page">
        <polymind-note id="note">
          <polymind-paragraph id="paragraph-1">Hello<anchor></anchor>World<focus></focus>Polymind</polymind-paragraph>
        </polymind-note>
      </polymind-page>
    `;

    const selection = host.selection.value[0] as TextSelection;
    expect(selection).toBeDefined();
    expect(selection.is(TextSelection)).toBe(true);
    expect(selection.from.blockId).toBe('paragraph-1');
    expect(selection.from.index).toBe(5);
    expect(selection.from.length).toBe(5);
    expect(selection.to).toBeNull();
  });
});
