'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Italic,
  Link2,
  List,
  ListOrdered,
  Underline as UnderlineIcon,
} from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { cn } from '@repo/ui/lib/utils';
import EditorCommand from '@/app/work-items/_components/workItem-description-editor-command';
import {
  CustomLinkExtension,
  normalizeLinkHref,
} from '@/lib/editor/tiptap-link-configuration';

type WorkItemFormModernDescriptionProps = {
  // eslint-disable-next-line no-unused-vars -- callback for FormData sync
  readonly onJsonChange: (json: string | null) => void;
};

type EditorSelectionRange = {
  from: number;
  to: number;
};

function isBlankHref(href: string): boolean {
  return !href || href === 'https://' || href === 'http://';
}

/**
 * Compact TipTap description for modern create. Toolbar floats only when text
 * is selected (BubbleMenu).
 */
export function WorkItemFormModernDescription({
  onJsonChange,
}: Readonly<WorkItemFormModernDescriptionProps>) {
  const linkInputId = useId();
  const [isEmpty, setIsEmpty] = useState(true);
  const [isLinkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [pendingSelection, setPendingSelection] =
    useState<EditorSelectionRange | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        link: false,
      }),
      CustomLinkExtension,
    ],
    content: '',
    editorProps: {
      attributes: {
        class: cn(
          'max-w-none min-h-16 px-3 py-2 text-lg outline-none',
          'text-foreground',
          'prose-base prose-p:my-1 prose-ul:my-1 prose-ol:my-1',
          '[&_ul]:list-disc [&_ol]:list-decimal'
        ),
        'aria-label': 'Description',
        role: 'textbox',
      },
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const sync = () => {
      const empty = editor.isEmpty;
      setIsEmpty(empty);
      if (empty) {
        onJsonChange(null);
        return;
      }
      onJsonChange(JSON.stringify(editor.getJSON()));
    };

    sync();
    editor.on('update', sync);
    return () => {
      editor.off('update', sync);
    };
  }, [editor, onJsonChange]);

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

  const openLinkDialog = () => {
    if (!editor) {
      return;
    }
    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const { from, to } = editor.state.selection;
    setPendingSelection({ from, to });
    setLinkUrl(String(editor.getAttributes('link').href ?? '') || 'https://');
    setLinkDialogOpen(true);
  };

  const closeLinkDialog = (open: boolean) => {
    setLinkDialogOpen(open);
    if (!open) {
      setPendingSelection(null);
      editor?.chain().focus().run();
    }
  };

  const applyLink = (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!editor) {
      return;
    }

    const href = normalizeLinkHref(linkUrl);
    if (isBlankHref(href)) {
      return;
    }

    const selection = pendingSelection ?? {
      from: editor.state.selection.from,
      to: editor.state.selection.to,
    };
    const { from, to } = selection;
    const chain = editor.chain().focus().setTextSelection({ from, to });

    if (from === to) {
      chain
        .insertContent({
          type: 'text',
          text: href,
          marks: [{ type: 'link', attrs: { href } }],
        })
        .run();
    } else {
      chain.setLink({ href }).run();
    }

    setPendingSelection(null);
    setLinkDialogOpen(false);
  };

  if (!editor) {
    return (
      <div
        className="text-muted-foreground/70 border-border/60 min-h-16 rounded-md border border-dashed px-3 py-2 text-lg"
        aria-label="Description"
      >
        Add a description…
      </div>
    );
  }

  return (
    <div className="relative">
      <BubbleMenu
        editor={editor}
        className="bg-popover text-popover-foreground border-border z-50 flex items-center gap-0.5 rounded-md border p-1 shadow-md"
      >
        <EditorCommand
          title="Bold"
          isActive={editorState?.isBoldActive ?? false}
          icon={<Bold className="size-4" />}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <EditorCommand
          title="Italic"
          isActive={editorState?.isItalicActive ?? false}
          icon={<Italic className="size-4" />}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <EditorCommand
          title="Underline"
          isActive={editorState?.isUnderlineActive ?? false}
          icon={<UnderlineIcon className="size-4" />}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        />
        <EditorCommand
          title="Link"
          isActive={editorState?.isLinkActive ?? false}
          icon={<Link2 className="size-4" />}
          onClick={openLinkDialog}
        />
        <EditorCommand
          title="Bullet list"
          isActive={editorState?.isBulletListActive ?? false}
          icon={<List className="size-4" />}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <EditorCommand
          title="Ordered list"
          isActive={editorState?.isOrderedListActive ?? false}
          icon={<ListOrdered className="size-4" />}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
      </BubbleMenu>
      <div className="border-border/60 relative rounded-md border border-dashed">
        {isEmpty ? (
          <span className="text-muted-foreground/70 pointer-events-none absolute top-2 left-3 text-lg">
            Add a description…
          </span>
        ) : null}
        <EditorContent editor={editor} />
      </div>

      <Dialog open={isLinkDialogOpen} onOpenChange={closeLinkDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add link</DialogTitle>
            <DialogDescription>Paste a full URL or domain.</DialogDescription>
          </DialogHeader>
          <form onSubmit={applyLink} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={linkInputId}>URL</Label>
              <Input
                id={linkInputId}
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
                placeholder="https://example.com"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => closeLinkDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Apply</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
