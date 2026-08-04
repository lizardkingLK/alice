'use client';

import { useCallback, useId, useState, type FormEvent } from 'react';
import type { Editor } from '@tiptap/react';
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
  applyEditorLink,
  isBlankHref,
  type EditorSelectionRange,
} from '@/lib/editor/tiptap-apply-link';
import { normalizeLinkHref } from '@/lib/editor/tiptap-link-configuration';

type UseEditorLinkDialogOptions = {
  /** Submit button label. Default: "Apply". */
  submitLabel?: string;
  /** Disable Apply when the href is blank / scheme-only. Default: false. */
  disableWhenBlank?: boolean;
};

/**
 * Shared TipTap "Add link" dialog state + UI for BubbleMenu and fixed toolbars.
 */
export function useEditorLinkDialog(
  editor: Editor,
  options: UseEditorLinkDialogOptions = {}
) {
  const { submitLabel = 'Apply', disableWhenBlank = false } = options;
  const linkInputId = useId();
  const [isOpen, setOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [pendingSelection, setPendingSelection] =
    useState<EditorSelectionRange | null>(null);

  const openLinkDialog = useCallback(() => {
    if (editor.isActive('link')) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const { from, to } = editor.state.selection;
    setPendingSelection({ from, to });
    setLinkUrl(String(editor.getAttributes('link').href ?? '') || 'https://');
    setOpen(true);
  }, [editor]);

  const closeLinkDialog = useCallback(
    (open: boolean) => {
      setOpen(open);
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
      if (!applyEditorLink(editor, linkUrl, pendingSelection)) {
        return;
      }
      setPendingSelection(null);
      setOpen(false);
    },
    [editor, linkUrl, pendingSelection]
  );

  const applyDisabled =
    disableWhenBlank && isBlankHref(normalizeLinkHref(linkUrl));

  const dialog = (
    <Dialog open={isOpen} onOpenChange={closeLinkDialog}>
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
              disabled={applyDisabled}
            >
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { openLinkDialog, dialog };
}
