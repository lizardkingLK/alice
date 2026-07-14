'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Bold, Italic, List } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

type WorkItemDescriptionEditorProps = {
  initialContent: string;
  // eslint-disable-next-line no-unused-vars
  onSave: (content: string) => void;
  onCancel: () => void;
};

export default function WorkItemDescriptionEditor({
  initialContent,
  onSave,
  onCancel,
}: Readonly<WorkItemDescriptionEditorProps>) {
  const editor = useEditor({
    immediatelyRender: true,
    extensions: [StarterKit],
    content: initialContent,
    editable: true,
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-sm dark:prose-invert max-w-none text-sm min-h-[120px]',
          'focus:outline-none outline-none',
          'p-3 border border-transparent rounded-md transition-all duration-150',
          'focus:border-border focus:bg-muted/10'
        ),
      },
    },
  });

  if (!editor) return null;

  return (
    <div className="flex w-full flex-col gap-2 bg-transparent">
      <div className="text-muted-foreground flex items-center gap-1 pb-1">
        <Button
          type="button"
          size="icon"
          variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
          className="h-8 w-8 shrink-0 cursor-pointer"
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
          className="h-8 w-8 shrink-0 cursor-pointer"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>

        <Button
          type="button"
          size="icon"
          variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
          className="h-8 w-8 shrink-0 cursor-pointer"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
      </div>

      <EditorContent editor={editor} />

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          className="cursor-pointer"
          size="sm"
          onClick={() => onSave(editor.getHTML())}
        >
          Save
        </Button>
        <Button
          className="cursor-pointer"
          size="sm"
          variant="ghost"
          onClick={onCancel}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
