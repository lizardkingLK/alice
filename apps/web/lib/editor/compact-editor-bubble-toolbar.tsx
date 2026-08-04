'use client';

import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { useEditorState } from '@tiptap/react';
import { EditorFormatCommands } from '@/lib/editor/editor-format-commands';
import { useEditorLinkDialog } from '@/lib/editor/editor-link-dialog';

type CompactEditorBubbleToolbarProps = {
  editor: Editor;
};

/**
 * Selection BubbleMenu for compact TipTap editors (bold/italic/underline/link/lists).
 */
export function CompactEditorBubbleToolbar({
  editor,
}: Readonly<CompactEditorBubbleToolbarProps>) {
  const { openLinkDialog, dialog } = useEditorLinkDialog(editor);

  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isBoldActive: ctx.editor?.isActive('bold') ?? false,
      isItalicActive: ctx.editor?.isActive('italic') ?? false,
      isUnderlineActive: ctx.editor?.isActive('underline') ?? false,
      isLinkActive: ctx.editor?.isActive('link') ?? false,
      isBulletListActive: ctx.editor?.isActive('bulletList') ?? false,
      isOrderedListActive: ctx.editor?.isActive('orderedList') ?? false,
    }),
  });

  return (
    <>
      <BubbleMenu
        editor={editor}
        className="bg-popover text-popover-foreground border-border z-50 flex items-center gap-0.5 rounded-md border p-1 shadow-md"
      >
        <EditorFormatCommands
          editor={editor}
          state={{
            isBoldActive: editorState?.isBoldActive ?? false,
            isItalicActive: editorState?.isItalicActive ?? false,
            isUnderlineActive: editorState?.isUnderlineActive ?? false,
            isLinkActive: editorState?.isLinkActive ?? false,
            isBulletListActive: editorState?.isBulletListActive ?? false,
            isOrderedListActive: editorState?.isOrderedListActive ?? false,
          }}
          onOpenLink={openLinkDialog}
        />
      </BubbleMenu>
      {dialog}
    </>
  );
}
