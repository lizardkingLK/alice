'use client';

import { useState } from 'react';
import type { WorkItemType } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Label } from '@repo/ui/components/ui/label';

type WorkItemTypeChangeDetachDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onOpenChange: (open: boolean) => void;
  readonly fromType: WorkItemType | string;
  readonly toType: WorkItemType | string;
  readonly childCount: number;
  readonly onConfirmDetach: () => void;
};

/**
 * Shown when changing type on a parent that still has subtasks (#482).
 * Default: detach children then convert (Jira-like). Alternate: cancel.
 */
export function WorkItemTypeChangeDetachDialog({
  open,
  onOpenChange,
  fromType,
  toType,
  childCount,
  onConfirmDetach,
}: Readonly<WorkItemTypeChangeDetachDialogProps>) {
  const [choice, setChoice] = useState<'detach' | 'cancel'>('detach');

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setChoice('detach');
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change type with subtasks?</DialogTitle>
          <DialogDescription>
            This {fromType} has {childCount} subtask
            {childCount === 1 ? '' : 's'}. Changing it to {toType} would break
            the hierarchy unless those links are removed first.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-3 py-2">
          <legend className="sr-only">Hierarchy handling</legend>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="radio"
              name="type-change-hierarchy"
              className="mt-1"
              checked={choice === 'detach'}
              onChange={() => setChoice('detach')}
            />
            <span className="text-sm">
              <span className="font-medium">
                Unlink subtasks, then change type to {toType}
              </span>
              <span className="text-muted-foreground block">
                Direct children become top-level items. Their own children stay
                attached to them.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="radio"
              name="type-change-hierarchy"
              className="mt-1"
              checked={choice === 'cancel'}
              onChange={() => setChoice('cancel')}
            />
            <Label className="text-sm font-normal">
              <span className="font-medium">Cancel — I will unlink first</span>
              <span className="text-muted-foreground block font-normal">
                Keep the current type and unlink subtasks yourself, then change
                the type afterwards.
              </span>
            </Label>
          </label>
        </fieldset>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setChoice('detach');
              onOpenChange(false);
            }}
          >
            Close
          </Button>
          <Button
            type="button"
            onClick={() => {
              if (choice === 'detach') {
                onConfirmDetach();
              }
              setChoice('detach');
              onOpenChange(false);
            }}
          >
            {choice === 'detach' ? 'Detach and continue' : 'Keep current type'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
