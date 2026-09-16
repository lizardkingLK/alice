'use client';

import { useEffect, useState } from 'react';
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

type ChatRenameDialogProps = {
  readonly open: boolean;
  readonly title: string;
  readonly isPending: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onConfirm: (title: string) => void;
};

export function ChatRenameDialog({
  open,
  title,
  isPending,
  onOpenChange,
  onConfirm,
}: Readonly<ChatRenameDialogProps>) {
  const [draft, setDraft] = useState(title);

  useEffect(() => {
    if (open) {
      setDraft(title);
    }
  }, [open, title]);

  const trimmed = draft.trim();
  const canSave = trimmed.length > 0 && trimmed !== title.trim() && !isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rename chat</DialogTitle>
          <DialogDescription>
            Update the title shown in history and the page breadcrumb.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label htmlFor="chat-rename-title">Title</Label>
          <Input
            id="chat-rename-title"
            value={draft}
            maxLength={120}
            disabled={isPending}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && canSave) {
                event.preventDefault();
                onConfirm(trimmed);
              }
            }}
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() => onConfirm(trimmed)}
          >
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
