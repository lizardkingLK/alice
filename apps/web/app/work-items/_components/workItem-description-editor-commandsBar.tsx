'use client';

import EditorCommand from '@/app/work-items/_components/workItem-description-editor-command';
import { normalizeLinkHref } from '@/lib/editor/tiptap-link-configuration';
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
import {
  Bold,
  Code2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Underline,
} from '@repo/ui/lib/icons';
import { Editor, useEditorState } from '@tiptap/react';
import { FormEvent, memo, useCallback, useId, useState } from 'react';

type EditorSelectionRange = {
  from: number;
  to: number;
};

function isBlankHref(href: string): boolean {
  return !href || href === 'https://' || href === 'http://';
}

const EditorCommandsBar = memo(function ({
  editor,
  isMaximized,
  onToggleMaximize,
}: Readonly<{
  readonly editor: Editor;
  isMaximized: boolean;
  readonly onToggleMaximize: () => void;
}>) {
  const linkInputId = useId();
  const [isLinkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [pendingSelection, setPendingSelection] =
    useState<EditorSelectionRange | null>(null);

  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isBoldActive: ctx.editor.isActive('bold'),
      isItalicActive: ctx.editor.isActive('italic'),
      isUnderlineActive: ctx.editor.isActive('underline'),
      isLinkActive: ctx.editor.isActive('link'),
      isBulletListActive: ctx.editor.isActive('bulletList'),
      isOrderedListActive: ctx.editor.isActive('orderedList'),
      isCodeBlockActive: ctx.editor.isActive('codeBlock'),
    }),
  });

  const openLinkDialog = useCallback(() => {
    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }

    const { from, to } = editor.state.selection;
    setPendingSelection({ from, to });
    setLinkUrl(String(editor.getAttributes('link').href ?? '') || 'https://');
    setLinkDialogOpen(true);
  }, [editor]);

  const closeLinkDialog = useCallback(
    (open: boolean) => {
      setLinkDialogOpen(open);
      if (!open) {
        setPendingSelection(null);
        editor.chain().focus().run();
      }
    },
    [editor]
  );

  const applyLink = useCallback(
    (event?: FormEvent<HTMLFormElement>) => {
      event?.preventDefault();

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

      // No selected text — insert the URL as linked text.
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
    },
    [editor, linkUrl, pendingSelection]
  );

  return (
    <>
      <div className="border-border/80 flex items-center gap-1 border-b pb-1">
        <div className="flex items-center gap-1">
          <EditorCommand
            isActive={editorState.isBoldActive}
            onClick={() => editor.chain().focus().toggleBold().run()}
            title="Bold"
            icon={<Bold className="h-4 w-4" />}
          />
          <EditorCommand
            isActive={editorState.isItalicActive}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            title="Italic"
            icon={<Italic className="h-4 w-4" />}
          />
          <EditorCommand
            isActive={editorState.isUnderlineActive}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
            title="Underline"
            icon={<Underline className="h-4 w-4" />}
          />
          <EditorCommand
            isActive={editorState.isLinkActive}
            onClick={openLinkDialog}
            title="Link"
            icon={<Link2 className="h-4 w-4" />}
          />
          <EditorCommand
            isActive={editorState.isBulletListActive}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            title="List"
            icon={<List className="h-4 w-4" />}
          />
          <EditorCommand
            isActive={editorState.isOrderedListActive}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            title="Ordered List"
            icon={<ListOrdered className="h-4 w-4" />}
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
                type="text"
                inputMode="url"
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
                className="cursor-pointer"
                onClick={() => closeLinkDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="cursor-pointer"
                disabled={isBlankHref(normalizeLinkHref(linkUrl))}
              >
                Apply link
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
});

EditorCommandsBar.displayName = 'EditorCommandsBar';

export default EditorCommandsBar;
