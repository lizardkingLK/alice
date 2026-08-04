'use client';

import type { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { useEditorState } from '@tiptap/react';
import { EditorFormatCommands } from '@/lib/editor/editor-format-commands';
import { useEditorLinkDialog } from '@/lib/editor/editor-link-dialog';
import { selectEditorFormatState } from '@/lib/editor/select-editor-format-state';

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
    selector: (ctx) => selectEditorFormatState(ctx.editor),
  });

  return (
    <>
      <BubbleMenu
        editor={editor}
        className="bg-popover text-popover-foreground border-border z-50 flex items-center gap-0.5 rounded-md border p-1 shadow-md"
      >
        <EditorFormatCommands
          editor={editor}
          state={editorState ?? selectEditorFormatState(null)}
          onOpenLink={openLinkDialog}
        />
      </BubbleMenu>
      {dialog}
    </>
  );
}
