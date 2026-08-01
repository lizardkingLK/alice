'use client';

import { useState } from 'react';
import { AlertTriangle, Unlink2 } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import { toast } from '@repo/ui/components/ui/sonner';
import { WorkItemActionDialog } from '@/app/work-items/_components/work-item-action-dialog';
import { patchWorkItemParentId } from '@/app/work-items/_helpers/patch-work-item-parent';
import type { WorkItemType } from '@repo/types';

/* eslint-disable no-unused-vars */
type WorkItemUnlinkSubtaskDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly childId: string;
  readonly childTitle: string;
  readonly childType: WorkItemType;
  readonly parentType: WorkItemType;
  readonly onUnlinked: () => void;
};
/* eslint-enable no-unused-vars */

export function WorkItemUnlinkSubtaskDialog({
  open,
  onOpenChange,
  childId,
  childTitle,
  childType,
  parentType,
  onUnlinked,
}: Readonly<WorkItemUnlinkSubtaskDialogProps>) {
  const [isPending, setIsPending] = useState(false);

  const handleConfirm = async () => {
    setIsPending(true);
    try {
      await patchWorkItemParentId(childId, null);
      toast.success('Subtask unlinked');
      onUnlinked();
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to unlink subtask.';
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <WorkItemActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Unlink subtask"
      titleIcon={<AlertTriangle className="text-destructive size-5 shrink-0" />}
      description={`Unlink “${childTitle}” from this ${parentType}? It will become an unparented ${childType} and can be linked again from Subtasks.`}
      isPending={isPending}
      onSubmit={() => {
        handleConfirm().catch(() => {});
      }}
      submitLabel="Unlink"
      pendingLabel="Unlinking..."
      submitVariant="destructive"
    />
  );
}

type UnlinkSubtaskButtonProps = {
  readonly onClick: () => void;
};

export function UnlinkSubtaskButton({
  onClick,
}: Readonly<UnlinkSubtaskButtonProps>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:text-destructive cursor-pointer"
      aria-label="Unlink subtask"
      onClick={onClick}
    >
      <Unlink2 />
    </Button>
  );
}
