'use client';

import { useState } from 'react';
import { AlertTriangle, Unlink2 } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import { toast } from '@repo/ui/components/ui/sonner';
import { WorkItemActionDialog } from '@/app/work-items/_components/work-item-details/work-item-action-dialog';
import { deleteWorkItemLink } from '@/app/work-items/_services/work-items.mutations.client';

/* eslint-disable no-unused-vars */
type WorkItemUnlinkIssueDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly workItemId: string;
  readonly linkId: string;
  readonly relatedTitle: string;
  readonly onUnlinked: (linkId: string) => void;
};
/* eslint-enable no-unused-vars */

export function WorkItemUnlinkIssueDialog({
  open,
  onOpenChange,
  workItemId,
  linkId,
  relatedTitle,
  onUnlinked,
}: Readonly<WorkItemUnlinkIssueDialogProps>) {
  const [isPending, setIsPending] = useState(false);

  const handleConfirm = async () => {
    setIsPending(true);
    try {
      await deleteWorkItemLink(workItemId, linkId);
      toast.success('Issue unlinked');
      onUnlinked(linkId);
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to unlink issue.';
      toast.error(message);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <WorkItemActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Unlink issue"
      titleIcon={<AlertTriangle className="text-destructive size-5 shrink-0" />}
      description={`Remove the relates-to link with “${relatedTitle}”?`}
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

type UnlinkIssueButtonProps = {
  readonly onClick: () => void;
};

export function UnlinkIssueButton({
  onClick,
}: Readonly<UnlinkIssueButtonProps>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:text-destructive cursor-pointer"
      aria-label="Unlink issue"
      title="Unlink issue"
      onClick={onClick}
    >
      <Unlink2 />
    </Button>
  );
}
