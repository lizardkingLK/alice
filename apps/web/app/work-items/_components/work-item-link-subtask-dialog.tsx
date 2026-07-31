'use client';

import { useEffect, useState } from 'react';
import { toast } from '@repo/ui/components/ui/sonner';
import { delay, toShortId } from '@/app/_shared/utility';
import { WorkItemActionDialog } from '@/app/work-items/_components/work-item-action-dialog';
import { FormStatusAlerts } from '@/app/work-items/_components/workItem-form-alerts';
import { patchWorkItemParentId } from '@/app/work-items/_helpers/patch-work-item-parent';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { WorkItemType } from '@repo/types';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';

type LinkableWorkItemOption = Pick<DbWorkItem, 'id' | 'title' | 'type'>;

/* eslint-disable no-unused-vars */
type WorkItemLinkSubtaskDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly parentWorkItemId: string;
  readonly parentType: WorkItemType;
  readonly childType: WorkItemType;
  readonly candidates: readonly LinkableWorkItemOption[];
  readonly onLinked: () => void;
};
/* eslint-enable no-unused-vars */

export function WorkItemLinkSubtaskDialog({
  open,
  onOpenChange,
  parentWorkItemId,
  parentType,
  childType,
  candidates,
  onLinked,
}: Readonly<WorkItemLinkSubtaskDialogProps>) {
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
        error: `Please select a ${childType} to link.`,
      });
      return;
    }

    setIsPending(true);
    setAlert(null);

    try {
      await patchWorkItemParentId(selectedId, parentWorkItemId);

      setAlert({ success: 'Subtask linked successfully.', error: null });
      await delay();
      toast.success('Subtask linked');
      onLinked();
      onOpenChange(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to link subtask.';
      setAlert({ success: null, error: message });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <WorkItemActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Link Subtask"
      description={`Link an existing ${childType} under this ${parentType}.`}
      isPending={isPending}
      onSubmit={() => {
        handleSave().catch(() => {});
      }}
      submitLabel="Link"
      pendingLabel="Linking..."
      submitDisabled={candidates.length === 0}
    >
      <div className="space-y-2">
        <Label htmlFor="link-subtask-work-item">{childType}</Label>
        {candidates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No unparented {childType} items in this project to link.
          </p>
        ) : (
          <Select
            value={selectedId}
            onValueChange={setSelectedId}
            disabled={isPending}
          >
            <SelectTrigger id="link-subtask-work-item">
              <SelectValue placeholder={`Select ${childType}…`} />
            </SelectTrigger>
            <SelectContent>
              {candidates.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="text-muted-foreground shrink-0 font-mono text-xs">
                      {toShortId(item.id)}
                    </span>
                    <TruncatedText className="text-sm">
                      {item.title}
                    </TruncatedText>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <FormStatusAlerts error={alert?.error} success={alert?.success} />
    </WorkItemActionDialog>
  );
}
