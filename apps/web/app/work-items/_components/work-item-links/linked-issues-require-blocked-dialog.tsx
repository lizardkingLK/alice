'use client';

import { AlertCircle } from '@repo/ui/lib/icons';
import { WorkItemActionDialog } from '@/app/work-items/_components/work-item-details/work-item-action-dialog';

/* eslint-disable no-unused-vars */
type LinkedIssuesRequireBlockedDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly message: string;
};
/* eslint-enable no-unused-vars */

/** Acknowledgment when a workflow edge blocks a move due to linked issues. */
export function LinkedIssuesRequireBlockedDialog({
  open,
  onOpenChange,
  message,
}: Readonly<LinkedIssuesRequireBlockedDialogProps>) {
  return (
    <WorkItemActionDialog
      open={open}
      onOpenChange={onOpenChange}
      mode="acknowledge"
      title="Cannot complete this transition"
      titleIcon={<AlertCircle className="size-5 shrink-0 text-amber-500" />}
      description={message}
    />
  );
}
