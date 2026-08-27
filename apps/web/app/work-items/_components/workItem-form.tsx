'use client';

import {
  DEFAULT_WORK_ITEM_PRIORITY,
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_TYPES,
  getAllowedParentType,
  parseWorkItemLabels,
  type WorkItemPriority,
  type WorkItemStatus,
  type WorkItemType,
} from '@repo/types';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { DialogFooter } from '@repo/ui/components/ui/dialog';
import { Loader2 } from '@repo/ui/lib/icons';
import { User as DbUser } from '@/app/users/_services/users.service';
import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import {
  createWorkItem,
  listParentCandidateWorkItems,
  updateWorkItem,
} from '@/app/work-items/_services/workItem.service.client';
import { FormStatusAlerts } from '@/app/work-items/_components/workItem-form-alerts';
import { WorkItemFormClassicFields } from '@/app/work-items/_components/work-item-form-classic';
import { WorkItemFormModernFields } from '@/app/work-items/_components/work-item-form-modern';
import type { WorkItemCreateFormMode } from '@/app/work-items/_helpers/work-item-create-form-preference';
import { Project as DbProject } from '@/app/projects/_services/projects.service';
import { useProjectMembers } from '@/app/work-items/_hooks/use-project-members';
import { delay, toShortId } from '@/app/_shared/utility';
import { ResponseDTO } from '@repo/types/connection';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { runLockedMutationOrThrow } from '@/lib/optimistic-lock/run-locked-mutation';
import type { SearchableSelectOption } from '@/components/searchable-select';

type WorkItemFormMember = Pick<DbUser, 'id' | 'name' | 'email'>;

export interface WorkItemFormProps {
  onClose?: () => void;
  // eslint-disable-next-line no-unused-vars
  onSuccess: (workItem: DbWorkItem) => void;
  projects: DbProject[];
  itemToEdit?: DbWorkItem | null;
  projectMembers: readonly WorkItemFormMember[];
  /** When true, project select is disabled (value still submitted). */
  lockProject?: boolean;
  /** When set, assignee select is disabled and defaults to this user on create. */
  lockAssigneeId?: string;
  /** Parent work item for subtask create (submitted as parent_id). */
  parentId?: string | null;
  /** When true, parent cannot be changed (e.g. create-subtask from details). */
  lockParent?: boolean;
  /** Restrict selectable types (defaults to all work-item types). */
  allowedTypes?: readonly WorkItemType[];
  /** When true, type select is disabled (value still submitted). */
  lockType?: boolean;
  /** Initial / locked status for create (e.g. board column). */
  defaultStatus?: WorkItemStatus;
  /** When true, status is fixed and submitted via hidden input. */
  lockStatus?: boolean;
  /** Optional sprint for create (e.g. board sprint filter). */
  defaultSprintId?: string | null;
  /**
   * Form layout preference (classic | modern). Applies to create and edit.
   * Defaults to classic when omitted.
   */
  createFormMode?: WorkItemCreateFormMode;
}

const taskTypes = WORK_ITEM_TYPES;
const ALERT_DISMISS_MS = 5000;

function isWorkItemPriority(value: string): value is WorkItemPriority {
  return (WORK_ITEM_PRIORITIES as readonly string[]).includes(value);
}

function isWorkItemType(value: string): value is WorkItemType {
  return (WORK_ITEM_TYPES as readonly string[]).includes(value);
}

function keepOrClearParentId(
  current: string,
  options: readonly SearchableSelectOption[]
): string {
  if (current && options.some((option) => option.value === current)) {
    return current;
  }
  return '';
}

const SubmitButtonText = ({
  isPending,
  isEditMode,
  modernCreate,
}: Readonly<{
  isPending: boolean;
  isEditMode: boolean;
  modernCreate: boolean;
}>) => {
  if (isPending) {
    return (
      <>
        <Loader2 className="animate-spin" />
        {isEditMode ? 'Saving...' : 'Creating...'}
      </>
    );
  }

  if (isEditMode) {
    return 'Save Changes';
  }

  return modernCreate ? 'Create' : 'Create Work Item';
};

export function WorkItemForm({
  onClose,
  onSuccess,
  itemToEdit = null,
  projectMembers,
  projects,
  lockProject = false,
  lockAssigneeId,
  parentId: lockedParentId = null,
  lockParent = false,
  allowedTypes,
  lockType = false,
  defaultStatus,
  lockStatus = false,
  defaultSprintId = null,
  createFormMode = 'classic',
}: Readonly<WorkItemFormProps>) {
  const { handleMutationError } = useOptimisticLock();
  const availableTypes =
    allowedTypes && allowedTypes.length > 0 ? allowedTypes : taskTypes;
  const typeLocked = lockType || availableTypes.length === 1;
  const isEditMode = itemToEdit !== null;
  const useModernLayout = createFormMode === 'modern';
  const parentLocked = lockParent;
  const initialParentId = lockParent
    ? (lockedParentId ?? '')
    : (itemToEdit?.parent_id ?? lockedParentId ?? '');

  const [isPending, setPending] = useState(false);
  const [state, setState] = useState<{
    success: string | null;
    error: string | null;
  } | null>(null);
  const [projectId, setProjectId] = useState(
    itemToEdit?.project_id ?? (lockProject ? (projects[0]?.id ?? '') : '')
  );
  const [assigneeId, setAssigneeId] = useState(
    itemToEdit?.assignee_id ?? lockAssigneeId ?? ''
  );
  const [type, setType] = useState(
    itemToEdit?.type ?? (typeLocked ? (availableTypes[0] ?? '') : '')
  );
  const [priority, setPriority] = useState<WorkItemPriority>(() => {
    const existing = itemToEdit?.priority;
    if (existing && isWorkItemPriority(existing)) {
      return existing;
    }
    return DEFAULT_WORK_ITEM_PRIORITY;
  });
  const [parentId, setParentId] = useState(initialParentId);
  const [parentOptions, setParentOptions] = useState<SearchableSelectOption[]>(
    []
  );
  const [parentOptionsLoading, setParentOptionsLoading] = useState(false);
  const lockAssignee = Boolean(lockAssigneeId);
  const statusValue: WorkItemStatus | '' =
    itemToEdit?.status ?? defaultStatus ?? '';

  const currentMembers = useProjectMembers({
    projectId,
    projectMembers,
    assigneeId,
    lockAssignee,
    onAssigneeChange: (val) => setAssigneeId(val ?? ''),
  });

  const allowedParentType =
    isWorkItemType(type) && !parentLocked ? getAllowedParentType(type) : null;

  useEffect(() => {
    if (parentLocked) {
      return;
    }
    if (!projectId || !allowedParentType) {
      setParentOptions([]);
      setParentId('');
      return;
    }

    let cancelled = false;
    setParentOptionsLoading(true);

    const loadParents = async () => {
      try {
        const items = await listParentCandidateWorkItems({
          projectId,
          parentType: allowedParentType,
          excludeId: itemToEdit?.id,
        });
        if (cancelled) {
          return;
        }
        const options = items.map((item) => ({
          value: item.id,
          label: `${toShortId(item.id)} · ${item.title}`,
        }));
        setParentOptions(options);
        setParentId((current) => keepOrClearParentId(current, options));
      } catch {
        if (!cancelled) {
          setParentOptions([]);
        }
      } finally {
        if (!cancelled) {
          setParentOptionsLoading(false);
        }
      }
    };

    loadParents().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [allowedParentType, itemToEdit?.id, parentLocked, projectId, type]);

  useEffect(() => {
    if (!useModernLayout || !state?.error) {
      return;
    }
    const timer = globalThis.setTimeout(() => {
      setState((current) => (current ? { ...current, error: null } : current));
    }, ALERT_DISMISS_MS);
    return () => globalThis.clearTimeout(timer);
  }, [useModernLayout, state?.error]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setState(null);

    const formData = new FormData(event.currentTarget);

    try {
      const isUpdate = isEditMode && itemToEdit;
      let response: ResponseDTO<DbWorkItem> | null = null;
      if (isUpdate) {
        const expectedUpdatedAt = itemToEdit.updated_at;
        response = await runLockedMutationOrThrow({
          mutate: () =>
            updateWorkItem(itemToEdit.id, formData, expectedUpdatedAt),
          handleMutationError,
          entityType: 'work_item',
          entityId: itemToEdit.id,
          expectedUpdatedAt,
          pendingFields: Object.fromEntries(formData.entries()),
        });
        if (!response) {
          return;
        }
      } else {
        response = await createWorkItem(formData);
      }

      setState({
        success: isEditMode
          ? 'Work item updated successfully.'
          : 'Work item created successfully.',
        error: null,
      });

      await delay();

      onSuccess(response.data!);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Something went wrong.';
      setState({ success: null, error: message });
    } finally {
      setPending(false);
    }
  };

  const fieldProps = {
    projects,
    projectMembers: currentMembers,
    availableTypes,
    projectId,
    assigneeId,
    type,
    priority,
    parentId: parentLocked ? (lockedParentId ?? parentId) : parentId,
    parentOptions,
    parentOptionsLoading,
    parentTypeLabel: allowedParentType,
    lockParent: parentLocked,
    lockProject,
    lockAssignee,
    typeLocked,
    lockStatus,
    status: statusValue,
    onProjectIdChange: setProjectId,
    onAssigneeIdChange: setAssigneeId,
    onTypeChange: setType,
    onPriorityChange: setPriority,
    onParentIdChange: setParentId,
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!isEditMode && defaultSprintId ? (
        <input type="hidden" name="sprint_id" value={defaultSprintId} />
      ) : null}

      {useModernLayout ? (
        <WorkItemFormModernFields
          {...fieldProps}
          titleDefault={itemToEdit?.title ?? ''}
          dueDateDefault={itemToEdit?.due_date ?? ''}
          storyPointsDefault={itemToEdit?.story_points ?? null}
          labelsDefault={parseWorkItemLabels(itemToEdit?.labels)}
          descriptionDefault={itemToEdit?.description ?? null}
        />
      ) : (
        <WorkItemFormClassicFields
          {...fieldProps}
          titleDefault={itemToEdit?.title ?? ''}
          dueDateDefault={itemToEdit?.due_date ?? ''}
          storyPointsDefault={itemToEdit?.story_points ?? null}
          labelsDefault={parseWorkItemLabels(itemToEdit?.labels)}
        />
      )}

      <FormStatusAlerts error={state?.error} success={state?.success} />

      <DialogFooter>
        {onClose ? (
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit">
          <SubmitButtonText
            isPending={isPending}
            isEditMode={isEditMode}
            modernCreate={useModernLayout}
          />
        </Button>
      </DialogFooter>
    </form>
  );
}
