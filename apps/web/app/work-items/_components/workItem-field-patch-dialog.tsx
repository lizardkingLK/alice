'use client';

import { useEffect, useState } from 'react';
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
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { toast } from '@repo/ui/components/ui/sonner';
import { delay, formatLabelWithSpace } from '@/app/_shared/utility';
import { MemberSelectItems } from '@/app/work-items/_components/member-select-items';
import { FormStatusAlerts } from '@/app/work-items/_components/workItem-form-alerts';
import { resolveWorkItemMember } from '@/app/work-items/_helpers/work-item-member';
import { WORK_ITEM_STATUSES } from '@/app/work-items/_helpers/work-item-status';
import {
  updateWorkItem,
  updateWorkItemStatus,
} from '@/app/work-items/_services/workItem.service.client';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';

export type WorkItemPatchFieldId =
  'assignee_id' | 'reporter_id' | 'title' | 'status';

export type WorkItemPatchFieldKind = 'user' | 'text' | 'status';

export type WorkItemPatchFieldConfig = {
  readonly field: WorkItemPatchFieldId;
  readonly kind: WorkItemPatchFieldKind;
  readonly title: string;
  readonly description: string;
  readonly label: string;
  readonly unassignedLabel?: string;
};

export { WORK_ITEM_STATUSES };

export const WORK_ITEM_PATCH_FIELD_CONFIG: Record<
  WorkItemPatchFieldId,
  WorkItemPatchFieldConfig
> = {
  title: {
    field: 'title',
    kind: 'text',
    title: 'Edit Title',
    description: 'Update the work item title. Keep it clear and concise.',
    label: 'Title',
  },
  status: {
    field: 'status',
    kind: 'status',
    title: 'Change Status',
    description: 'Confirm the new status for this work item.',
    label: 'Status',
  },
  assignee_id: {
    field: 'assignee_id',
    kind: 'user',
    title: 'Change Assignee',
    description:
      'Assign this work item to a project member, or leave unassigned.',
    label: 'Assignee',
    unassignedLabel: 'Unassigned',
  },
  reporter_id: {
    field: 'reporter_id',
    kind: 'user',
    title: 'Change Reporter',
    description: 'Set who reported this work item, or leave unassigned.',
    label: 'Reporter',
    unassignedLabel: 'Unassigned',
  },
};

export type WorkItemPatchMemberOption = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly profile_picture?: string | null;
};

const UNASSIGNED_VALUE = 'unassigned';

/* eslint-disable no-unused-vars */
type WorkItemFieldPatchDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly workItemId: string;
  readonly fieldConfig: WorkItemPatchFieldConfig;
  readonly options?: readonly WorkItemPatchMemberOption[];
  readonly currentValue: string | null;
  readonly onPatched: (updated: Partial<DbWorkItem>) => void;
};
/* eslint-enable no-unused-vars */

function relationKeyForField(
  field: 'assignee_id' | 'reporter_id'
): 'assignee' | 'reporter' {
  return field === 'assignee_id' ? 'assignee' : 'reporter';
}

function buildUserPatchPayload(args: {
  readonly field: 'assignee_id' | 'reporter_id';
  readonly nextId: string;
  readonly members: readonly WorkItemPatchMemberOption[];
  readonly updated: Partial<DbWorkItem> | null | undefined;
}): Partial<DbWorkItem> {
  const { field, nextId, members, updated } = args;
  const relationKey = relationKeyForField(field);
  const selectedMember = resolveWorkItemMember(members, nextId || null);

  return {
    [field]: nextId || null,
    [relationKey]: updated?.[relationKey] ?? selectedMember,
  };
}

function initialSelectedValue(
  kind: WorkItemPatchFieldKind,
  currentValue: string | null
): string {
  if (kind === 'user') {
    return currentValue ?? UNASSIGNED_VALUE;
  }
  return currentValue ?? '';
}

export function WorkItemFieldPatchDialog({
  open,
  onOpenChange,
  workItemId,
  fieldConfig,
  options = [],
  currentValue,
  onPatched,
}: Readonly<WorkItemFieldPatchDialogProps>) {
  const isTextField = fieldConfig.kind === 'text';
  const isStatusField = fieldConfig.kind === 'status';
  const [selectedValue, setSelectedValue] = useState(
    initialSelectedValue(fieldConfig.kind, currentValue)
  );
  const [isPending, setIsPending] = useState(false);
  const [alert, setAlert] = useState<{
    success: string | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSelectedValue(initialSelectedValue(fieldConfig.kind, currentValue));
    setAlert(null);
    setIsPending(false);
  }, [open, currentValue, fieldConfig.field, fieldConfig.kind]);

  const finishWithInDialogSuccess = async (
    successMessage: string,
    patched: Partial<DbWorkItem>
  ) => {
    setAlert({ success: successMessage, error: null });
    await delay();
    onPatched(patched);
    onOpenChange(false);
  };

  const saveTextField = async () => {
    const nextTextValue = selectedValue.trim();
    if (!nextTextValue) {
      setAlert({ success: null, error: 'Title is required.' });
      return;
    }

    const formData = new FormData();
    formData.set('title', nextTextValue);
    const response = await updateWorkItem(workItemId, formData);

    await finishWithInDialogSuccess(
      `${fieldConfig.label} updated successfully.`,
      {
        title: response.data?.title ?? nextTextValue,
      }
    );
  };

  const saveStatusField = async () => {
    const nextStatus = selectedValue as DbWorkItem['status'];
    const response = await updateWorkItemStatus(workItemId, nextStatus);
    const status = response.data?.status ?? nextStatus;

    toast.success(`Status updated to ${formatLabelWithSpace(status)}.`);
    onPatched({ status });
    onOpenChange(false);
  };

  const saveUserField = async () => {
    const nextId = selectedValue === UNASSIGNED_VALUE ? '' : selectedValue;
    const formData = new FormData();
    formData.set(fieldConfig.field, nextId);
    const response = await updateWorkItem(workItemId, formData);
    const userField = fieldConfig.field as 'assignee_id' | 'reporter_id';

    await finishWithInDialogSuccess(
      `${fieldConfig.label} updated successfully.`,
      buildUserPatchPayload({
        field: userField,
        nextId,
        members: options,
        updated: response.data,
      })
    );
  };

  const handleSave = async () => {
    setIsPending(true);
    setAlert(null);

    try {
      if (fieldConfig.kind === 'text') {
        await saveTextField();
      } else if (fieldConfig.kind === 'status') {
        await saveStatusField();
      } else {
        await saveUserField();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong.';
      setAlert({ success: null, error: message });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/80 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{fieldConfig.title}</DialogTitle>
          <DialogDescription>{fieldConfig.description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-2">
            <Label htmlFor={`patch-${fieldConfig.field}`}>
              {fieldConfig.label}
            </Label>
            {isTextField ? (
              <Input
                id={`patch-${fieldConfig.field}`}
                value={selectedValue}
                maxLength={200}
                disabled={isPending}
                autoFocus
                onChange={(event) => setSelectedValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    handleSave().catch(() => {});
                  }
                }}
              />
            ) : (
              <Select
                value={selectedValue}
                onValueChange={setSelectedValue}
                disabled={isPending}
              >
                <SelectTrigger id={`patch-${fieldConfig.field}`}>
                  <SelectValue
                    placeholder={
                      isStatusField
                        ? 'Select status'
                        : (fieldConfig.unassignedLabel ?? 'Select…')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {isStatusField ? (
                    WORK_ITEM_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {formatLabelWithSpace(status)}
                      </SelectItem>
                    ))
                  ) : (
                    <MemberSelectItems
                      members={options}
                      unassignedLabel={fieldConfig.unassignedLabel}
                      unassignedValue={UNASSIGNED_VALUE}
                    />
                  )}
                </SelectContent>
              </Select>
            )}
          </div>

          <FormStatusAlerts error={alert?.error} success={alert?.success} />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={isPending} onClick={handleSave}>
            {isPending ? (
              <>
                <Loader2 className="animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
