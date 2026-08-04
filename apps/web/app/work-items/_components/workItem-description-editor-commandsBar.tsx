'use client';

import EditorCommand from '@/app/work-items/_components/workItem-description-editor-command';
import { EditorFormatCommands } from '@/lib/editor/editor-format-commands';
import { useEditorLinkDialog } from '@/lib/editor/editor-link-dialog';
import { selectEditorFormatState } from '@/lib/editor/select-editor-format-state';
import { Button } from '@repo/ui/components/ui/button';
import { Code2, Maximize2, Minimize2 } from '@repo/ui/lib/icons';
import { Editor, useEditorState } from '@tiptap/react';
import { memo } from 'react';

const EditorCommandsBar = memo(function ({
  editor,
  isMaximized,
  onToggleMaximize,
}: Readonly<{
  readonly editor: Editor;
  isMaximized: boolean;
  readonly onToggleMaximize: () => void;
}>) {
  const { openLinkDialog, dialog } = useEditorLinkDialog(editor, {
    submitLabel: 'Apply link',
    disableWhenBlank: true,
  });

  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      ...selectEditorFormatState(ctx.editor),
      isCodeBlockActive: ctx.editor.isActive('codeBlock'),
    }),
  });

  return (
    <>
      <div className="border-border/80 flex items-center gap-1 border-b pb-1">
        <div className="flex items-center gap-1">
          <EditorFormatCommands
            editor={editor}
            state={editorState}
            onOpenLink={openLinkDialog}
            iconClassName="h-4 w-4"
            bulletListTitle="List"
            orderedListTitle="Ordered List"
          />
          <EditorCommand
            isActive={editorState.isCodeBlockActive}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
            title="Code Block"
            icon={<Code2 className="h-4 w-4" />}
          />
        </div>

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="ml-auto h-8 w-8 shrink-0 cursor-pointer"
          onClick={onToggleMaximize}
          title={isMaximized ? 'Minimize Editor' : 'Maximize Editor'}
        >
          {isMaximized ? (
            <Minimize2 className="h-4 w-4" />
          ) : (
            <Maximize2 className="h-4 w-4" />
          )}
        </Button>
      </div>
      {dialog}
    </>
  );
});

EditorCommandsBar.displayName = 'EditorCommandsBar';

export default EditorCommandsBar;
