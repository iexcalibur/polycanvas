import type { PolymindTextAttributes } from '@blockmind/polymind-shared/types';
import type { BlockComponent } from '@blockmind/std';
import { InlineMarkdownExtension } from '@blockmind/std/inline';

export const LatexExtension = InlineMarkdownExtension<PolymindTextAttributes>({
  name: 'latex',

  pattern:
    /(?:\$\$)(?<content>[^$]+)(?:\$\$)\s$|(?<blockPrefix>\$\$\$\$)\s$|(?<inlinePrefix>\$\$)\s$/g,
  action: ({ inlineEditor, prefixText, inlineRange, pattern, undoManager }) => {
    const match = pattern.exec(prefixText);
    if (!match || !match.groups) return;
    const content = match.groups['content'];
    const inlinePrefix = match.groups['inlinePrefix'];
    const blockPrefix = match.groups['blockPrefix'];

    if (!inlineEditor.rootElement) return;
    const blockComponent =
      inlineEditor.rootElement.closest<BlockComponent>('[data-block-id]');
    if (!blockComponent) return;

    const doc = blockComponent.store;

    const parentComponent = blockComponent.parentComponent;
    if (!parentComponent) return;
    const index = parentComponent.model.children.indexOf(blockComponent.model);
    if (index === -1) return;

    if (blockPrefix === '$$$$') {
      undoManager.stopCapturing();

      inlineEditor.deleteText({
        index: inlineRange.index - 5,
        length: 5,
      });

      const id = doc.addBlock(
        'polymind:latex',
        {
          latex: '',
        },
        parentComponent.model,
        index + 1
      );
      blockComponent.host.updateComplete
        .then(() => {
          const latexBlock = blockComponent.std.view.getBlock(id);
          if (!latexBlock || latexBlock.flavour !== 'polymind:latex') return;

          //FIXME(@Flrande): wait for refactor
          // @ts-expect-error BS-2241
          latexBlock.toggleEditor();
        })
        .catch(console.error);

      return;
    }

    if (inlinePrefix === '$$') {
      undoManager.stopCapturing();

      inlineEditor.deleteText({
        index: inlineRange.index - 3,
        length: 3,
      });
      inlineEditor.insertText(
        {
          index: inlineRange.index - 3,
          length: 0,
        },
        ' '
      );
      inlineEditor.formatText(
        {
          index: inlineRange.index - 3,
          length: 1,
        },
        {
          latex: '',
        }
      );

      inlineEditor
        .waitForUpdate()
        .then(async () => {
          await inlineEditor.waitForUpdate();

          const textPoint = inlineEditor.getTextPoint(
            inlineRange.index - 3 + 1
          );
          if (!textPoint) return;

          const [text] = textPoint;
          const latexNode = text.parentElement?.closest('polymind-latex-node');
          if (!latexNode) return;

          latexNode.toggleEditor();
        })
        .catch(console.error);

      return;
    }

    if (!content || content.length === 0) return;

    undoManager.stopCapturing();

    const startIndex = inlineRange.index - 1 - 2 - content.length - 2;
    inlineEditor.deleteText({
      index: startIndex,
      length: 2 + content.length + 2 + 1,
    });
    inlineEditor.insertText(
      {
        index: startIndex,
        length: 0,
      },
      ' '
    );
    inlineEditor.formatText(
      {
        index: startIndex,
        length: 1,
      },
      {
        latex: String.raw`${content}`,
      }
    );

    inlineEditor.setInlineRange({
      index: startIndex + 1,
      length: 0,
    });
  },
});
