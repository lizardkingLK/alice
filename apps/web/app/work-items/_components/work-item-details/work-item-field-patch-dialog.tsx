'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { parseWorkItemLabels } from '@repo/types';
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
import { delay } from '@/app/_shared/utility';
import { WorkItemActionDialog } from '@/app/work-items/_components/work-item-details/work-item-action-dialog';
import { buildMemberSelectOptions } from '@/app/work-items/_components/member-select-items';
import { resolveWorkItemMember } from '@/app/work-items/_helpers/work-item-member';
import {
  boardColumnIdForStateOption,
  legacyWorkflowStateOptions,
  resolveStatePresentation,
  type WorkflowStateOption,
} from '@/app/work-items/_helpers/workflow-state-options';
import {
  selectValueFromSprintId,
  sprintIdFromSelectValue,
  WORK_ITEM_SPRINT_BACKLOG_VALUE,
  type WorkItemSprintOption,
} from '@/app/work-items/_helpers/work-item-sprint';
import { SearchableSelect } from '@/components/searchable-select';
import {
  updateWorkItem,
  updateWorkItemStatus,
} from '@/app/work-items/_services/work-items.mutations.client';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { tryHandleLockedMutationError } from '@/lib/optimistic-lock/run-locked-mutation';
import {
  isWorkflowMoveBlockedError,
  toastWorkflowMoveBlockedFromError,
  workflowMoveBlockedDescription,
} from '@/app/board/_helpers/workflow-move-blocked-toast';
import { WorkItemLabelsInput } from '@/app/work-items/_components/work-item-labels/work-item-labels-input';
import { FormStatusAlerts } from '@/app/work-items/_components/work-item-form/work-item-form-alerts';
import { toDateInputValue } from '@/app/work-items/_helpers/work-item-due-date';
import { cn } from '@repo/ui/lib/utils';

export type WorkItemPatchFieldId =
  | 'assignee_id'
  | 'reporter_id'
  | 'title'
  | 'status'
  | 'labels'
  | 'sprint_id'
  | 'due_date';

export type WorkItemPatchFieldKind =
  'user' | 'text' | 'status' | 'labels' | 'sprint' | 'date';

export type WorkItemPatchFieldConfig = {
  readonly field: WorkItemPatchFieldId;
  readonly kind: WorkItemPatchFieldKind;
  readonly title: string;
  readonly description: string;
  readonly label: string;
  readonly unassignedLabel?: string;
};

export { WORK_ITEM_STATUSES } from '@/app/work-items/_helpers/work-item-status';

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
  labels: {
    field: 'labels',
    kind: 'labels',
    title: 'Edit Labels',
    description:
      'Add or remove labels. Matching is exact and case-sensitive when searching.',
    label: 'Labels',
  },
  sprint_id: {
    field: 'sprint_id',
    kind: 'sprint',
    title: 'Change Sprint',
    description:
      'Move this work item into a sprint, or clear to keep it on the backlog.',
    label: 'Sprint',
    unassignedLabel: 'Backlog',
  },
  due_date: {
    field: 'due_date',
    kind: 'date',
    title: 'Change Due Date',
    description: 'Set or clear the due date for this work item.',
    label: 'Due date',
  },
};

export type WorkItemPatchMemberOption = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly profile_picture?: string | null;
};

const UNASSIGNED_VALUE = 'unassigned';
const EMPTY_PATCH_LABELS: readonly string[] = [];

/* eslint-disable no-unused-vars */
type WorkItemFieldPatchDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly workItemId: string;
  /** ISO `updated_at` from the last successful load/save (optimistic lock). */
  readonly expectedUpdatedAt: string;
  readonly fieldConfig: WorkItemPatchFieldConfig;
  readonly options?: readonly WorkItemPatchMemberOption[];
  /** When set, status field lists workflow states (value = state id). */
  readonly stateOptions?: readonly WorkflowStateOption[];
  /** Sprint options for the sprint_id patch field. */
  readonly sprintOptions?: readonly WorkItemSprintOption[];
  readonly currentValue: string | null;
  readonly currentLabels?: readonly string[];
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
  if (kind === 'sprint') {
    return selectValueFromSprintId(currentValue);
  }
  if (kind === 'date') {
    return toDateInputValue(currentValue);
  }
  return currentValue ?? '';
}

export function WorkItemFieldPatchDialog({
  open,
  onOpenChange,
  workItemId,
  expectedUpdatedAt,
  fieldConfig,
  options = [],
  stateOptions,
  sprintOptions = [],
  currentValue,
  currentLabels = EMPTY_PATCH_LABELS,
  onPatched,
}: Readonly<WorkItemFieldPatchDialogProps>) {
  const router = useRouter();
  const { handleMutationError } = useOptimisticLock();
  const isTextField = fieldConfig.kind === 'text';
  const isStatusField = fieldConfig.kind === 'status';
  const isLabelsField = fieldConfig.kind === 'labels';
  const isSprintField = fieldConfig.kind === 'sprint';
  const isDateField = fieldConfig.kind === 'date';
  const statusChoices: readonly WorkflowStateOption[] =
    stateOptions ?? legacyWorkflowStateOptions();
  const [selectedValue, setSelectedValue] = useState(
    initialSelectedValue(fieldConfig.kind, currentValue)
  );
  const [labelsValue, setLabelsValue] = useState<string[]>(() => [
    ...currentLabels,
  ]);
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
    setLabelsValue([...currentLabels]);
    setAlert(null);
    setIsPending(false);
    // Seed once when the dialog opens; a default `currentLabels = []` would
    // retrigger this effect every render and overflow the update depth.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open transition only
  }, [open]);

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
    const response = await updateWorkItem(
      workItemId,
      formData,
      expectedUpdatedAt
    );

    await finishWithInDialogSuccess(
      `${fieldConfig.label} updated successfully.`,
      {
        title: response.data?.title ?? nextTextValue,
        updated_at: response.data?.updated_at,
      }
    );
  };

  const saveStatusField = async () => {
    const selected =
      statusChoices.find((option) => option.id === selectedValue) ?? null;
    if (!selected) {
      setAlert({
        success: null,
        error: `Select a ${fieldConfig.label.toLowerCase()}.`,
      });
      return;
    }
    const boardColumnId = boardColumnIdForStateOption(selected);
    const response = await updateWorkItemStatus(
      workItemId,
      selected.status,
      expectedUpdatedAt,
      boardColumnId
    );
    const status = response.data?.status ?? selected.status;

    toast.success(`${fieldConfig.label} updated to ${selected.name}.`);
    onPatched({
      status,
      board_column_id: response.data?.board_column_id ?? boardColumnId,
      state: response.data?.state,
      updated_at: response.data?.updated_at,
    });
    onOpenChange(false);
  };

  const saveUserField = async () => {
    const nextId = selectedValue === UNASSIGNED_VALUE ? '' : selectedValue;
    const formData = new FormData();
    formData.set(fieldConfig.field, nextId);
    const response = await updateWorkItem(
      workItemId,
      formData,
      expectedUpdatedAt
    );
    const userField = fieldConfig.field as 'assignee_id' | 'reporter_id';

    await finishWithInDialogSuccess(
      `${fieldConfig.label} updated successfully.`,
      {
        ...buildUserPatchPayload({
          field: userField,
          nextId,
          members: options,
          updated: response.data,
        }),
        updated_at: response.data?.updated_at,
      }
    );
  };

  const saveLabelsField = async () => {
    const formData = new FormData();
    formData.set('labels', JSON.stringify(labelsValue));
    const response = await updateWorkItem(
      workItemId,
      formData,
      expectedUpdatedAt
    );
    const nextLabels =
      parseWorkItemLabels(response.data?.labels) ?? labelsValue;

    await finishWithInDialogSuccess(
      `${fieldConfig.label} updated successfully.`,
      {
        labels: nextLabels,
        updated_at: response.data?.updated_at,
      }
    );
  };

  const saveSprintField = async () => {
    const nextSprintId = sprintIdFromSelectValue(selectedValue);
    const formData = new FormData();
    formData.set('sprint_id', nextSprintId ?? '');
    const response = await updateWorkItem(
      workItemId,
      formData,
      expectedUpdatedAt
    );
    const selectedSprint =
      sprintOptions.find((sprint) => sprint.id === nextSprintId) ?? null;
    const cascadedCount = response.cascadedSprintDescendantIds?.length ?? 0;
    let successMessage = `${fieldConfig.label} updated successfully.`;
    if (cascadedCount > 0) {
      const subtaskLabel = cascadedCount === 1 ? 'subtask' : 'subtasks';
      successMessage = `${fieldConfig.label} updated for this item and ${cascadedCount} ${subtaskLabel}.`;
    }

    await finishWithInDialogSuccess(successMessage, {
      sprint_id: response.data?.sprint_id ?? nextSprintId,
      sprint:
        response.data?.sprint ??
        (selectedSprint
          ? { id: selectedSprint.id, name: selectedSprint.name }
          : null),
      updated_at: response.data?.updated_at,
    });

    if (cascadedCount > 0) {
      router.refresh();
    }
  };

  const saveDateField = async () => {
    const nextDueDate = selectedValue.trim();
    const formData = new FormData();
    formData.set('due_date', nextDueDate);
    const response = await updateWorkItem(
      workItemId,
      formData,
      expectedUpdatedAt
    );

    await finishWithInDialogSuccess(
      `${fieldConfig.label} updated successfully.`,
      {
        due_date: response.data?.due_date ?? (nextDueDate || null),
        updated_at: response.data?.updated_at,
      }
    );
  };

  const saveByKind = async () => {
    switch (fieldConfig.kind) {
      case 'text':
        await saveTextField();
        return;
      case 'status':
        await saveStatusField();
        return;
      case 'labels':
        await saveLabelsField();
        return;
      case 'sprint':
        await saveSprintField();
        return;
      case 'date':
        await saveDateField();
        return;
      default:
        await saveUserField();
    }
  };

  const pendingFieldsForKind = (): Record<string, unknown> => {
    switch (fieldConfig.kind) {
      case 'text':
        return { title: selectedValue.trim() };
      case 'status':
        return { status: selectedValue };
      case 'labels':
        return { labels: labelsValue };
      case 'sprint':
        return { sprint_id: sprintIdFromSelectValue(selectedValue) };
      case 'date':
        return { due_date: selectedValue.trim() || null };
      default:
        return {
          [fieldConfig.field]:
            selectedValue === UNASSIGNED_VALUE ? null : selectedValue,
        };
    }
  };

  const handleSave = async () => {
    setIsPending(true);
    setAlert(null);

    try {
      await saveByKind();
    } catch (error) {
      if (
        await tryHandleLockedMutationError({
          error,
          handleMutationError,
          entityType: 'work_item',
          entityId: workItemId,
          expectedUpdatedAt,
          pendingFields: pendingFieldsForKind(),
        })
      ) {
        onOpenChange(false);
        return;
      }

      const message =
        error instanceof Error ? error.message : 'Something went wrong.';
      if (fieldConfig.kind === 'status' && isWorkflowMoveBlockedError(error)) {
        toastWorkflowMoveBlockedFromError(error);
        setAlert({
          success: null,
          error: workflowMoveBlockedDescription(message),
        });
      } else {
        setAlert({ success: null, error: message });
      }
    } finally {
      setIsPending(false);
    }
  };

  let fieldControl: ReactNode;
  if (isTextField) {
    fieldControl = (
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
    );
  } else if (isStatusField) {
    fieldControl = (
      <Select
        value={selectedValue}
        onValueChange={setSelectedValue}
        disabled={isPending}
      >
        <SelectTrigger id={`patch-${fieldConfig.field}`}>
          <SelectValue
            placeholder={`Select ${fieldConfig.label.toLowerCase()}`}
          />
        </SelectTrigger>
        <SelectContent>
          {statusChoices.map((option) => {
            const presentation = resolveStatePresentation({
              category: option.category,
              status: option.status,
              stateName: option.name,
            });
            const OptionIcon = presentation.icon;
            return (
              <SelectItem key={option.id} value={option.id}>
                <span className="flex items-center gap-2">
                  <OptionIcon
                    className={cn('h-3.5 w-3.5', presentation.textClass)}
                  />
                  <span className={presentation.textClass}>{option.name}</span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  } else if (isLabelsField) {
    fieldControl = (
      <WorkItemLabelsInput
        id={`patch-${fieldConfig.field}`}
        name={`patch-${fieldConfig.field}`}
        value={labelsValue}
        onChange={setLabelsValue}
        disabled={isPending}
      />
    );
  } else if (isSprintField) {
    fieldControl = (
      <SearchableSelect
        id={`patch-${fieldConfig.field}`}
        value={selectedValue}
        onValueChange={setSelectedValue}
        disabled={isPending}
        placeholder={fieldConfig.unassignedLabel ?? 'Backlog'}
        options={[
          {
            value: WORK_ITEM_SPRINT_BACKLOG_VALUE,
            label: fieldConfig.unassignedLabel ?? 'Backlog',
          },
          ...sprintOptions.map((sprint) => ({
            value: sprint.id,
            label: sprint.name,
          })),
        ]}
        emptyText="No matching sprints."
      />
    );
  } else if (isDateField) {
    fieldControl = (
      <Input
        id={`patch-${fieldConfig.field}`}
        type="date"
        value={selectedValue}
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
    );
  } else {
    fieldControl = (
      <SearchableSelect
        id={`patch-${fieldConfig.field}`}
        value={selectedValue}
        onValueChange={setSelectedValue}
        disabled={isPending}
        placeholder={fieldConfig.unassignedLabel ?? 'Search…'}
        options={buildMemberSelectOptions({
          members: options,
          unassignedLabel: fieldConfig.unassignedLabel,
          unassignedValue: UNASSIGNED_VALUE,
        })}
        emptyText="No matching people."
      />
    );
  }

  return (
    <WorkItemActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title={fieldConfig.title}
      description={fieldConfig.description}
      isPending={isPending}
      onSubmit={() => {
        handleSave().catch(() => {});
      }}
    >
      <div className="space-y-2">
        <Label htmlFor={`patch-${fieldConfig.field}`}>
          {fieldConfig.label}
        </Label>
        {fieldControl}
      </div>

      <FormStatusAlerts error={alert?.error} success={alert?.success} />
    </WorkItemActionDialog>
  );
}
