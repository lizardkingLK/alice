'use client';

import { AlertTriangle } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';

type CalendarDueDateWarningDialogProps = {
  readonly open: boolean;
  readonly message: string;
  readonly onClose: () => void;
};

export function CalendarDueDateWarningDialog({
  open,
  message,
  onClose,
}: Readonly<CalendarDueDateWarningDialogProps>) {
  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
    >
      <DialogContent className="bg-card border-border/80 sm:max-w-md">
        <DialogHeader className="flex flex-col items-center pb-2 text-center">
          <div className="mb-2 rounded-full bg-amber-500/15 p-3">
            <AlertTriangle className="size-6 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-lg font-bold">
            Cannot update due date
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm">
            {message}
            {message
              ? '. The work item was kept on its previous due date.'
              : null}
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end pt-2">
          <Button type="button" size="sm" onClick={onClose}>
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
