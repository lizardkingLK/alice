import type { Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';

/**
 * Turns hard breaks inside the current selection into paragraph splits so
 * multi-line selections become separate blocks before list wrap.
 * Returns true when the document was modified.
 */
export function splitHardBreaksInSelection(editor: Editor): boolean {
  const { state } = editor;
  const { from, to } = state.selection;
  const hardBreakPositions: number[] = [];

  state.doc.nodesBetween(from, to, (node, pos) => {
    if (node.type.name === 'hardBreak') {
      hardBreakPositions.push(pos);
    }
  });

  if (hardBreakPositions.length === 0) {
    return false;
  }

  // Replace from the end so earlier positions stay valid via mapping.
  let { tr } = state;
  for (const pos of [...hardBreakPositions].reverse()) {
    const mappedPos = tr.mapping.map(pos);
    const hardBreakNode = tr.doc.nodeAt(mappedPos);
    if (hardBreakNode?.type.name !== 'hardBreak') {
      continue;
    }

    tr = tr.delete(mappedPos, mappedPos + hardBreakNode.nodeSize);
    try {
      tr = tr.split(mappedPos);
    } catch {
      // Split can fail at invalid positions; skip that break.
    }
  }

  if (!tr.docChanged) {
    return false;
  }

  const newFrom = tr.mapping.map(from, -1);
  const newTo = tr.mapping.map(to, 1);
  const size = tr.doc.content.size;
  tr = tr.setSelection(
    TextSelection.create(
      tr.doc,
      Math.max(1, Math.min(newFrom, size)),
      Math.max(1, Math.min(newTo, size))
    )
  );
  editor.view.dispatch(tr);
  return true;
}

/** Wrap selection in a bullet/ordered list, expanding hard breaks first. */
export function toggleListPreservingLines(
  editor: Editor,
  list: 'bulletList' | 'orderedList'
): void {
  splitHardBreaksInSelection(editor);
  const chain = editor.chain().focus();
  if (list === 'bulletList') {
    chain.toggleBulletList().run();
  } else {
    chain.toggleOrderedList().run();
  }
}
