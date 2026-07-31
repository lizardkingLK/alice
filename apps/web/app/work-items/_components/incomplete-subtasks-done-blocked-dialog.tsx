'use client';

import { AlertCircle } from '@repo/ui/lib/icons';
import { WorkItemActionDialog } from '@/app/work-items/_components/work-item-action-dialog';

/* eslint-disable no-unused-vars */
type IncompleteSubtasksDoneBlockedDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly incompleteCount: number;
};
/* eslint-enable no-unused-vars */

export function IncompleteSubtasksDoneBlockedDialog({
  open,
  onOpenChange,
  incompleteCount,
}: Readonly<IncompleteSubtasksDoneBlockedDialogProps>) {
  const subtaskLabel =
    incompleteCount === 1
      ? '1 subtask is still incomplete'
      : `${incompleteCount} subtasks are still incomplete`;

  return (
    <WorkItemActionDialog
      open={open}
      onOpenChange={onOpenChange}
      mode="acknowledge"
      title="Cannot mark as Done"
      titleIcon={<AlertCircle className="size-5 shrink-0 text-amber-500" />}
      description={`${subtaskLabel}. Complete or unlink them before marking this work item as Done.`}
    />
  );
}
