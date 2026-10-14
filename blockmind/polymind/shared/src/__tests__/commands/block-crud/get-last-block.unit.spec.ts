/**
 * @vitest-environment happy-dom
 */
import { describe, expect, it } from 'vitest';

import { getLastBlockCommand } from '../../../commands/block-crud/get-last-content-block';
import { polymind } from '../../../test-utils';

describe('commands/block-crud', () => {
  describe('getLastBlockCommand', () => {
    it('should return null when root is not exists', () => {
      const host = polymind`<polymind-page></polymind-page>`;

      const [_, { lastBlock }] = host.command.exec(getLastBlockCommand, {
        role: 'content',
        root: undefined,
      });

      expect(lastBlock).toBeNull();
    });

    it('should return last block with content role when found', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note id="note-1">
            <polymind-paragraph id="paragraph-1-1">First Paragraph</polymind-paragraph>
            <polymind-paragraph id="paragraph-1-2">Second Paragraph</polymind-paragraph>
          </polymind-note>
          <polymind-note id="note-2">
            <polymind-paragraph id="paragraph-2-1">First Paragraph</polymind-paragraph>
            <polymind-paragraph id="paragraph-2-2">Second Paragraph</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const [_, { lastBlock }] = host.command.exec(getLastBlockCommand, {
        role: 'hub',
        root: undefined,
      });

      expect(lastBlock?.id).toBe('note-2');
    });

    it('should return last block with any role in the array when found', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note id="note-1">
            <polymind-paragraph id="paragraph-1-1">First Paragraph</polymind-paragraph>
            <polymind-paragraph id="paragraph-1-2">Second Paragraph</polymind-paragraph>
          </polymind-note>
          <polymind-note id="note-2">
            <polymind-paragraph id="paragraph-2-1">First Paragraph</polymind-paragraph>
            <polymind-paragraph id="paragraph-2-2">Second Paragraph</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const [_, { lastBlock }] = host.command.exec(getLastBlockCommand, {
        role: ['hub', 'content'],
        root: undefined,
      });

      expect(lastBlock?.id).toBe('note-2');
    });

    it('should return last block with specified flavour when found', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note id="note-1">
            <polymind-paragraph id="paragraph-1">Paragraph</polymind-paragraph>
            <polymind-list id="list-1">List Item</polymind-list>
          </polymind-note>
        </polymind-page>
      `;

      const note = host.store.getBlock('note-1')?.model;

      const [_, { lastBlock }] = host.command.exec(getLastBlockCommand, {
        flavour: 'polymind:list',
        root: note,
      });

      expect(lastBlock?.id).toBe('list-1');
    });

    it('should return last block with any flavour in the array when found', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note id="note-1">
            <polymind-paragraph id="paragraph-1">Paragraph</polymind-paragraph>
            <polymind-list id="list-1">List Item</polymind-list>
          </polymind-note>
        </polymind-page>
      `;

      const note = host.store.getBlock('note-1')?.model;

      const [_, { lastBlock }] = host.command.exec(getLastBlockCommand, {
        flavour: ['polymind:list', 'polymind:code'],
        root: note,
      });

      expect(lastBlock?.id).toBe('list-1');
    });

    it('should return last block matching both role and flavour when both specified', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note id="note-1">
            <polymind-paragraph id="paragraph-1">Content Paragraph</polymind-paragraph>
            <polymind-list id="list-1">Content List</polymind-list>
            <polymind-paragraph id="paragraph-2">hub Paragraph</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const note = host.store.getBlock('note-1')?.model;
      const [_, { lastBlock }] = host.command.exec(getLastBlockCommand, {
        role: 'content',
        flavour: 'polymind:list',
        root: note,
      });

      expect(lastBlock?.id).toBe('list-1');
    });

    it('should return last block with default roles when role not specified', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note id="note-1">
            <polymind-paragraph id="paragraph-1">hub Paragraph</polymind-paragraph>
            <polymind-paragraph id="paragraph-2">Content Paragraph</polymind-paragraph>
            <polymind-paragraph id="paragraph-3">Hub Paragraph</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const [_, { lastBlock }] = host.command.exec(getLastBlockCommand, {
        root: undefined,
      });

      expect(lastBlock?.id).toBe('note-1');
    });

    it('should return last block with specified role when found', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note id="note-1">
            <polymind-paragraph id="paragraph-1">Content Paragraph</polymind-paragraph>
            <polymind-paragraph id="paragraph-2">hub Paragraph</polymind-paragraph>
            <polymind-database id="database-1">Database</polymind-database>
          </polymind-note>
        </polymind-page>
      `;

      const note = host.store.getBlock('note-1')?.model;

      const [_, { lastBlock }] = host.command.exec(getLastBlockCommand, {
        role: 'hub',
        root: note,
      });

      expect(lastBlock?.id).toBe('database-1');
    });

    it('should return null when no blocks with specified role are found in children', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note id="note-1">
            <polymind-paragraph id="paragraph-1">Content Paragraph</polymind-paragraph>
            <polymind-paragraph id="paragraph-2">Another Content Paragraph</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const note = host.store.getBlock('note-1')?.model;

      const [_, { lastBlock }] = host.command.exec(getLastBlockCommand, {
        role: 'hub',
        root: note,
      });

      expect(lastBlock).toBeNull();
    });

    it('should return null when no blocks with specified flavour are found in children', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note id="note-1">
            <polymind-paragraph id="paragraph-1">Paragraph</polymind-paragraph>
            <polymind-paragraph id="paragraph-2">Another Paragraph</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const note = host.store.getBlock('note-1')?.model;

      const [_, { lastBlock }] = host.command.exec(getLastBlockCommand, {
        flavour: 'polymind:list',
        root: note,
      });

      expect(lastBlock).toBeNull();
    });

    it('should return last block with specified role within specified root subtree', () => {
      const host = polymind`
        <polymind-page>
          <polymind-note id="note-1">
            <polymind-paragraph id="paragraph-1-1">1-1 Content</polymind-paragraph>
            <polymind-paragraph id="paragraph-1-2">1-2 hub</polymind-paragraph>
          </polymind-note>
          <polymind-note id="note-2">
            <polymind-paragraph id="paragraph-2-1">2-1 hub</polymind-paragraph>
            <polymind-paragraph id="paragraph-2-2">2-2 Content</polymind-paragraph>
          </polymind-note>
        </polymind-page>
      `;

      const note = host.store.getBlock('note-2')?.model;

      const [_, { lastBlock }] = host.command.exec(getLastBlockCommand, {
        role: 'content',
        root: note,
      });

      expect(lastBlock?.id).toBe('paragraph-2-2');
    });
  });
});
