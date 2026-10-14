import type { SetStateAction } from 'jotai';
import { atom, useAtom } from 'jotai';

import type { PolymindEditorContainer } from '../../blockmind/block-suite-editor';

const activeEditorContainerAtom = atom<PolymindEditorContainer | null>(null);

export function useActiveBlocksuiteEditor(): [
  PolymindEditorContainer | null,
  React.Dispatch<SetStateAction<PolymindEditorContainer | null>>,
] {
  const [editorContainer, setEditorContainer] = useAtom(
    activeEditorContainerAtom
  );

  return [editorContainer, setEditorContainer];
}
