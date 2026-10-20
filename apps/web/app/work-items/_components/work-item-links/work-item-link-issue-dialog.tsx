'use client';

import { useEffect, useState } from 'react';
import { toast } from '@repo/ui/components/ui/sonner';
import { delay, toShortId } from '@/app/_shared/utility';
import { WorkItemActionDialog } from '@/app/work-items/_components/work-item-details/work-item-action-dialog';
import { FormStatusAlerts } from '@/app/work-items/_components/work-item-form/work-item-form-alerts';
import { createWorkItemLink } from '@/app/work-items/_services/work-items.mutations.client';
import type { WorkItemLinkListItem } from '@repo/types';
import { Label } from '@repo/ui/components/ui/label';
import { SearchableSelect } from '@/components/searchable-select';

type LinkableIssueOption = {
  readonly id: string;
  readonly title: string;
  readonly type: string;
};

/* eslint-disable no-unused-vars */
type WorkItemLinkIssueDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly workItemId: string;
  readonly candidates: readonly LinkableIssueOption[];
  readonly onLinked: (link: WorkItemLinkListItem) => void;
};
/* eslint-enable no-unused-vars */

export function WorkItemLinkIssueDialog({
  open,
  onOpenChange,
  workItemId,
  candidates,
  onLinked,
}: Readonly<WorkItemLinkIssueDialogProps>) {
  const [selectedId, setSelectedId] = useState('');
  const [isPending, setIsPending] = useState(false);
  const [alert, setAlert] = useState<{
    success: string | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedId('');
    setAlert(null);
    setIsPending(false);
  }, [open]);

  const handleSave = async () => {
    if (!selectedId) {
      setAlert({
        success: null,
        error: 'Please select a work item to link.',
      });
      return;
    }

    setIsPending(true);
    setAlert(null);

    try {
      const link = await createWorkItemLink(workItemId, selectedId);
      setAlert({ success: 'Issue linked successfully.', error: null });
      await delay();
      toast.success('Issue linked');
      onLinked(link);
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to link issue.';
      setAlert({ success: null, error: message });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <WorkItemActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Link issue"
      description="Create a relates-to link with another work item in this project."
      isPending={isPending}
      onSubmit={() => {
        handleSave().catch(() => {});
      }}
      submitLabel="Link"
      pendingLabel="Linking..."
      submitDisabled={candidates.length === 0}
    >
      <div className="space-y-2">
        <Label htmlFor="link-issue-work-item">Work item</Label>
        {candidates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No other work items in this project are available to link.
          </p>
        ) : (
          <SearchableSelect
            id="link-issue-work-item"
            value={selectedId}
            onValueChange={setSelectedId}
            placeholder="Search work items…"
            options={candidates.map((item) => ({
              value: item.id,
              label: `${toShortId(item.id)} · ${item.title}`,
            }))}
          />
        )}
      </div>

      <FormStatusAlerts error={alert?.error} success={alert?.success} />
    </WorkItemActionDialog>
  );
}
