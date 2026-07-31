'use client';

import type { ReactNode } from 'react';
import { Loader2 } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';

/* eslint-disable no-unused-vars */
type WorkItemActionDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly isPending: boolean;
  readonly onSubmit: () => void;
  readonly submitLabel?: string;
  readonly pendingLabel?: string;
  readonly submitDisabled?: boolean;
};
/* eslint-enable no-unused-vars */

/**
 * Shared chrome for small work-item action dialogs (field patch, link subtask).
 */
export function WorkItemActionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  isPending,
  onSubmit,
  submitLabel = 'Save',
  pendingLabel = 'Saving...',
  submitDisabled = false,
}: Readonly<WorkItemActionDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/80 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">{children}</div>

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
            disabled={isPending || submitDisabled}
            onClick={onSubmit}
          >
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                {pendingLabel}
              </>
            ) : (
              submitLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
