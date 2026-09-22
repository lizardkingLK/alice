'use client';

import { useEffect, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
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

type ChartsSaveWorkspaceDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onOpenChange: (open: boolean) => void;
  readonly defaultTitle: string;
  readonly initialIsOverview?: boolean;
  /** Create a new workspace vs rename/save the current one. */
  readonly mode?: 'create' | 'save';
  readonly onSave: (
    // eslint-disable-next-line no-unused-vars
    payload: { title: string; isOverview: boolean }
  ) => void | Promise<void>;
};

export function ChartsSaveWorkspaceDialog({
  open,
  onOpenChange,
  defaultTitle,
  initialIsOverview = false,
  mode = 'save',
  onSave,
}: Readonly<ChartsSaveWorkspaceDialogProps>) {
  const [title, setTitle] = useState(defaultTitle);
  const [isOverview, setIsOverview] = useState(initialIsOverview);
  const [pending, setPending] = useState(false);
  const isCreate = mode === 'create';
  const confirmLabel = (() => {
    if (pending) {
      return isCreate ? 'Creating…' : 'Saving…';
    }
    return isCreate ? 'Create' : 'Save';
  })();

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(defaultTitle);
    setIsOverview(initialIsOverview);
    setPending(false);
  }, [open, defaultTitle, initialIsOverview]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) {
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? 'New workspace' : 'Save workspace'}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? 'Name the new chart workspace. You can change this later from the workspace menu.'
              : 'Name this chart workspace. Marking as overview is separate from which board the sidebar opens last.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="chart-workspace-title">Name</Label>
            <Input
              id="chart-workspace-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Charts"
              autoFocus
              disabled={pending}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={isOverview}
              disabled={pending}
              onCheckedChange={(checked) => setIsOverview(checked === true)}
            />
            Mark as overview
          </label>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={!title.trim() || pending}
            onClick={() => {
              void (async () => {
                setPending(true);
                try {
                  await onSave({ title: title.trim(), isOverview });
                  onOpenChange(false);
                } catch {
                  setPending(false);
                }
              })();
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
