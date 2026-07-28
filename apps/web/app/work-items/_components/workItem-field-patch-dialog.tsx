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
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import { delay, getInitials } from '@/app/_shared/utility';
import { FormStatusAlerts } from '@/app/work-items/_components/workItem-form-alerts';
import { updateWorkItem } from '@/app/work-items/_services/workItem.service.client';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';

export type WorkItemPatchFieldId = 'assignee_id' | 'reporter_id';

export type WorkItemPatchFieldConfig = {
  readonly field: WorkItemPatchFieldId;
  readonly title: string;
  readonly description: string;
  readonly label: string;
  readonly unassignedLabel: string;
};

export const WORK_ITEM_PATCH_FIELD_CONFIG: Record<
  WorkItemPatchFieldId,
  WorkItemPatchFieldConfig
> = {
  assignee_id: {
    field: 'assignee_id',
    title: 'Change Assignee',
    description:
      'Assign this work item to a project member, or leave unassigned.',
    label: 'Assignee',
    unassignedLabel: 'Unassigned',
  },
  reporter_id: {
    field: 'reporter_id',
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
  readonly options: readonly WorkItemPatchMemberOption[];
  readonly currentValue: string | null;
  readonly onPatched: (updated: Partial<DbWorkItem>) => void;
};
/* eslint-enable no-unused-vars */

function relationKeyForField(
  field: WorkItemPatchFieldId
): 'assignee' | 'reporter' {
  return field === 'assignee_id' ? 'assignee' : 'reporter';
}

export function WorkItemFieldPatchDialog({
  open,
  onOpenChange,
  workItemId,
  fieldConfig,
  options,
  currentValue,
  onPatched,
}: Readonly<WorkItemFieldPatchDialogProps>) {
  const [selectedValue, setSelectedValue] = useState(
    currentValue ?? UNASSIGNED_VALUE
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
    setSelectedValue(currentValue ?? UNASSIGNED_VALUE);
    setAlert(null);
    setIsPending(false);
  }, [open, currentValue, fieldConfig.field]);

  const handleSave = async () => {
    setIsPending(true);
    setAlert(null);

    const formData = new FormData();
    const nextId = selectedValue === UNASSIGNED_VALUE ? '' : selectedValue;
    formData.set(fieldConfig.field, nextId);

    try {
      const response = await updateWorkItem(workItemId, formData);
      const updated = response.data;

      setAlert({
        success: `${fieldConfig.label} updated successfully.`,
        error: null,
      });

      await delay();

      const relationKey = relationKeyForField(fieldConfig.field);
      const selectedMember =
        nextId === ''
          ? null
          : (options.find((member) => member.id === nextId) ?? null);

      onPatched({
        [fieldConfig.field]: nextId || null,
        [relationKey]:
          updated?.[relationKey] ??
          (selectedMember
            ? {
                id: selectedMember.id,
                name: selectedMember.name,
                email: selectedMember.email,
                profile_picture: selectedMember.profile_picture ?? null,
              }
            : null),
      });

      onOpenChange(false);
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
            <Select value={selectedValue} onValueChange={setSelectedValue}>
              <SelectTrigger id={`patch-${fieldConfig.field}`}>
                <SelectValue placeholder={fieldConfig.unassignedLabel} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED_VALUE}>
                  {fieldConfig.unassignedLabel}
                </SelectItem>
                {options.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm" className="size-5">
                        {member.profile_picture ? (
                          <AvatarImage
                            src={member.profile_picture}
                            alt={member.name}
                          />
                        ) : null}
                        <AvatarFallback className="text-[8px]">
                          {getInitials(member.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{member.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
