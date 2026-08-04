import type { Editor } from '@tiptap/react';
import type { EditorFormatCommandState } from '@/lib/editor/editor-format-commands';

/** Shared TipTap format-mark active state for bubble / command toolbars. */
export function selectEditorFormatState(
  editor: Editor | null | undefined
): EditorFormatCommandState {
  return {
    isBoldActive: editor?.isActive('bold') ?? false,
    isItalicActive: editor?.isActive('italic') ?? false,
    isUnderlineActive: editor?.isActive('underline') ?? false,
    isLinkActive: editor?.isActive('link') ?? false,
    isBulletListActive: editor?.isActive('bulletList') ?? false,
    isOrderedListActive: editor?.isActive('orderedList') ?? false,
  };
}
