import type { Editor } from '@tiptap/react';
import { normalizeLinkHref } from '@/lib/editor/tiptap-link-configuration';

export type EditorSelectionRange = {
  from: number;
  to: number;
};

export function isBlankHref(href: string): boolean {
  return !href || href === 'https://' || href === 'http://';
}

/**
 * Applies a link mark to the current (or pending) selection.
 * When the selection is empty, inserts the URL as linked text.
 * Returns false when the href is blank / invalid.
 */
export function applyEditorLink(
  editor: Editor,
  rawHref: string,
  pendingSelection: EditorSelectionRange | null = null
): boolean {
  const href = normalizeLinkHref(rawHref);
  if (isBlankHref(href)) {
    return false;
  }

  const selection = pendingSelection ?? {
    from: editor.state.selection.from,
    to: editor.state.selection.to,
  };
  const { from, to } = selection;
  const chain = editor.chain().focus().setTextSelection({ from, to });

  if (from === to) {
    return chain
      .insertContent({
        type: 'text',
        text: href,
        marks: [{ type: 'link', attrs: { href } }],
      })
      .run();
  }

  return chain.setLink({ href }).run();
}
