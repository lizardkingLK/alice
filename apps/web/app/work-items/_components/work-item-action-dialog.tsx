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

type ConfirmModeProps = {
  readonly mode?: 'confirm';
  readonly children?: ReactNode;
  readonly isPending: boolean;
  readonly onSubmit: () => void;
  readonly submitLabel?: string;
  readonly pendingLabel?: string;
  readonly submitDisabled?: boolean;
  readonly submitVariant?: 'default' | 'destructive' | 'outline' | 'secondary';
};

type AcknowledgeModeProps = {
  readonly mode: 'acknowledge';
  readonly children?: ReactNode;
  readonly isPending?: never;
  readonly onSubmit?: never;
  readonly submitLabel?: string;
  readonly pendingLabel?: never;
  readonly submitDisabled?: never;
  readonly submitVariant?: never;
};

/* eslint-disable no-unused-vars */
type WorkItemActionDialogBaseProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description: string;
  readonly titleIcon?: ReactNode;
};
/* eslint-enable no-unused-vars */

type WorkItemActionDialogProps = WorkItemActionDialogBaseProps &
  (ConfirmModeProps | AcknowledgeModeProps);

/**
 * Shared chrome for small work-item action dialogs (field patch, link/unlink,
 * acknowledgment warnings).
 */
export function WorkItemActionDialog({
  open,
  onOpenChange,
  title,
  description,
  titleIcon,
  children,
  mode = 'confirm',
  isPending = false,
  onSubmit,
  submitLabel,
  pendingLabel = 'Saving...',
  submitDisabled = false,
  submitVariant = 'default',
}: Readonly<WorkItemActionDialogProps>) {
  const isAcknowledge = mode === 'acknowledge';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/80 sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            className={titleIcon ? 'flex items-center gap-2' : undefined}
          >
            {titleIcon}
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {children ? <div className="space-y-4 py-1">{children}</div> : null}

        <DialogFooter>
          {isAcknowledge ? (
            <Button type="button" onClick={() => onOpenChange(false)}>
              {submitLabel ?? 'OK'}
            </Button>
          ) : (
            <>
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
                variant={submitVariant}
                disabled={isPending || submitDisabled}
                onClick={onSubmit}
              >
                {isPending ? (
                  <>
                    <Loader2 className="animate-spin" />
                    {pendingLabel}
                  </>
                ) : (
                  (submitLabel ?? 'Save')
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
