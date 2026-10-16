'use client';

import { useEffect, useState } from 'react';
import { WorkItemDetailsConfigureForm } from '@/app/work-items/_components/work-item-details/work-item-details-configure-form';
import type { WorkItemDetailsPreferences } from '@/app/work-items/_helpers/work-item-details-preferences';
import { afterDialogClose } from '@/lib/dialog-close';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';

type WorkItemDetailsConfigureDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- open-change callback
  readonly onOpenChange: (open: boolean) => void;
  readonly value: WorkItemDetailsPreferences;
  // eslint-disable-next-line no-unused-vars -- preference change callback
  readonly onChange: (next: WorkItemDetailsPreferences) => void;
};

export function WorkItemDetailsConfigureDialog({
  open,
  onOpenChange,
  value,
  onChange,
}: Readonly<WorkItemDetailsConfigureDialogProps>) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) {
      setDraft(value);
    }
  }, [open, value]);

  useEffect(() => {
    if (open) {
      return;
    }
    return afterDialogClose(() => {
      setDraft(value);
    });
  }, [open, value]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,40rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-border shrink-0 space-y-1.5 border-b px-6 py-4 text-left">
          <DialogTitle>Configure work item view</DialogTitle>
          <DialogDescription>
            Customize the user interface for work-items.
          </DialogDescription>
        </DialogHeader>
        {/* Native overflow — Radix ScrollArea + flex-1 often clips body content. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6">
          <div className="py-4">
            <WorkItemDetailsConfigureForm value={draft} onChange={setDraft} />
          </div>
        </div>
        <div className="border-border flex shrink-0 justify-end gap-2 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            onClick={() => {
              onChange(draft);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
