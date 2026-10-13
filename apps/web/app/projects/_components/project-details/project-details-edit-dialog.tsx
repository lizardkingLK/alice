'use client';

import { useEffect, useMemo, useState } from 'react';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Textarea } from '@repo/ui/components/ui/textarea';
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
import { FormStatusAlerts } from '@/app/work-items/_components/work-item-form/work-item-form-alerts';
import {
  updateProject,
  type Project,
} from '@/app/projects/_services/projects.mutations.client';
import type { User } from '@/app/users/_services/users.mutations.client';
import { SearchableSelect } from '@/components/searchable-select';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { runLockedMutationOrThrow } from '@/lib/optimistic-lock/run-locked-mutation';
import { errorMessage } from '@/lib/errors/error-message';

function formatDateForInput(dateString?: string | null): string {
  if (!dateString) {
    return '';
  }
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().slice(0, 10);
}

/* eslint-disable no-unused-vars */
type ProjectDetailsEditDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly project: Project;
  /** Users with manager role available as project owners. */
  readonly ownerOptions?: readonly User[];
  readonly onPatched: (updated: Project) => void;
};
/* eslint-enable no-unused-vars */

/**
 * Light edit dialog for Details-tab metadata (name, timeline, description,
 * owner, status). Intentionally smaller than the full project form.
 */
export function ProjectDetailsEditDialog({
  open,
  onOpenChange,
  project,
  ownerOptions = [],
  onPatched,
}: Readonly<ProjectDetailsEditDialogProps>) {
  const { handleMutationError } = useOptimisticLock();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description ?? '');
  const [startDate, setStartDate] = useState(
    formatDateForInput(project.start_date)
  );
  const [endDate, setEndDate] = useState(formatDateForInput(project.end_date));
  const [ownerId, setOwnerId] = useState(project.owner_id);
  const [status, setStatus] = useState<'active' | 'archived'>(
    project.status === 'archived' ? 'archived' : 'active'
  );
  const [isPending, setIsPending] = useState(false);
  const [alert, setAlert] = useState<{
    success: string | null;
    error: string | null;
  } | null>(null);

  const ownerSelectOptions = useMemo(
    () =>
      ownerOptions
        .filter((user) => user.role === 'manager')
        .map((user) => ({
          value: user.id,
          label: `${user.name} (${user.email})`,
        })),
    [ownerOptions]
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    setName(project.name);
    setDescription(project.description ?? '');
    setStartDate(formatDateForInput(project.start_date));
    setEndDate(formatDateForInput(project.end_date));
    setOwnerId(project.owner_id);
    setStatus(project.status === 'archived' ? 'archived' : 'active');
    setAlert(null);
    setIsPending(false);
    // Seed once when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open transition only
  }, [open]);

  const handleSubmit = async () => {
    const nextName = name.trim();
    if (!nextName) {
      setAlert({ success: null, error: 'Name is required.' });
      return;
    }
    if (!ownerId) {
      setAlert({ success: null, error: 'Owner is required.' });
      return;
    }
    if (startDate && endDate && endDate < startDate) {
      setAlert({
        success: null,
        error: 'End date must be on or after the start date.',
      });
      return;
    }

    setIsPending(true);
    setAlert(null);

    const pendingFields = {
      name: nextName,
      description: description.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      owner_id: ownerId,
      status,
    };

    try {
      const updated = await runLockedMutationOrThrow({
        mutate: () =>
          updateProject(project.id, pendingFields, project.updated_at),
        handleMutationError,
        entityType: 'project',
        entityId: project.id,
        expectedUpdatedAt: project.updated_at,
        pendingFields,
      });

      if (!updated) {
        setIsPending(false);
        return;
      }

      setAlert({ success: 'Project details updated.', error: null });
      await delay();
      onPatched(updated);
      onOpenChange(false);
      toast.success('Project details updated.');
    } catch (error) {
      setAlert({
        success: null,
        error: errorMessage(error, 'Failed to update project.'),
      });
    } finally {
      setIsPending(false);
    }
  };

  return (
    <WorkItemActionDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Edit project details"
      description="Update name, timeline, description, owner, and status."
      isPending={isPending}
      onSubmit={handleSubmit}
      submitLabel="Save"
      submitDisabled={isPending}
    >
      <div className="space-y-4">
        <FormStatusAlerts error={alert?.error} success={alert?.success} />
        <div className="space-y-2">
          <Label htmlFor="project-details-edit-name">Name</Label>
          <Input
            id="project-details-edit-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="project-details-edit-start">Start date</Label>
            <Input
              id="project-details-edit-start"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-details-edit-end">End date</Label>
            <Input
              id="project-details-edit-end"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="project-details-edit-description">Description</Label>
          <Textarea
            id="project-details-edit-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="project-details-edit-owner">Owner</Label>
            <SearchableSelect
              id="project-details-edit-owner"
              value={ownerId}
              onValueChange={setOwnerId}
              placeholder="Search managers…"
              options={ownerSelectOptions}
              emptyText="No matching managers."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="project-details-edit-status">Status</Label>
            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as 'active' | 'archived')
              }
            >
              <SelectTrigger id="project-details-edit-status">
                <SelectValue placeholder="Select status…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </WorkItemActionDialog>
  );
}
