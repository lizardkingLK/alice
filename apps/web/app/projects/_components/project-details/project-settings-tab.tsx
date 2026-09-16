'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Label } from '@repo/ui/components/ui/label';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Settings,
} from '@repo/ui/lib/icons';
import {
  CANONICAL_HIERARCHY_ORDER,
  type WorkItemType,
  WorkItemTypeEnum,
} from '@repo/types';
import type { ProjectWorkflowConfig } from '@repo/types/api/v1';
import { updateProject, type Project } from '@/app/projects/_services/projects.mutations.client';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { runLockedMutationOrThrow } from '@/lib/optimistic-lock/run-locked-mutation';
import { errorMessage } from '@/lib/errors/error-message';

export type ProjectSettingsTabProps = {
  readonly project: Project;
  readonly isManagerOrAdmin: boolean;
};

const ALL_TYPES: readonly WorkItemType[] = CANONICAL_HIERARCHY_ORDER;

export function ProjectSettingsTab({
  project,
  isManagerOrAdmin,
}: Readonly<ProjectSettingsTabProps>) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { handleMutationError } = useOptimisticLock();

  const existingConfig =
    (project.workflow_config as ProjectWorkflowConfig | null) ?? null;
  const initialTypes: WorkItemType[] =
    existingConfig?.work_item_types && existingConfig.work_item_types.length > 0
      ? existingConfig.work_item_types
      : [...ALL_TYPES];

  const [selectedTypes, setSelectedTypes] = useState<WorkItemType[]>(initialTypes);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const removedTypes = initialTypes.filter((t) => !selectedTypes.includes(t));
  const hasRemovedTypes = removedTypes.length > 0;

  const handleToggleType = (type: WorkItemType, checked: boolean) => {
    setFeedback(null);
    if (checked) {
      const next = ALL_TYPES.filter(
        (t) => t === type || selectedTypes.includes(t)
      );
      setSelectedTypes(next);
    } else {
      setSelectedTypes(selectedTypes.filter((t) => t !== type));
    }
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (selectedTypes.length === 0) {
      setFeedback({
        type: 'error',
        text: 'Please select at least one work-item type.',
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    const mergedWorkflowConfig: ProjectWorkflowConfig = {
      ...(existingConfig || {}),
      work_item_types: selectedTypes,
    };

    const pendingFields = {
      workflow_config: mergedWorkflowConfig,
    };

    try {
      await runLockedMutationOrThrow({
        mutate: () =>
          updateProject(project.id, pendingFields, project.updated_at),
        handleMutationError,
        entityType: 'project',
        entityId: project.id,
        expectedUpdatedAt: project.updated_at,
        pendingFields,
      });

      setFeedback({
        type: 'success',
        text: hasRemovedTypes
          ? `Work-item types updated. Items with removed types (${removedTypes.join(', ')}) have fallen back to Issue.`
          : 'Project work-item types updated successfully.',
      });

      startTransition(() => {
        router.refresh();
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: errorMessage(err, 'Failed to update project settings.'),
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isManagerOrAdmin) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground text-sm">
            Only Project Managers and Administrators can configure project settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-primary flex items-center gap-2 text-base font-semibold">
            <Settings className="h-5 w-5" />
            Allowed Work-Item Types
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Configure which work-item types are permitted in this project. Subtasks and
            forms will automatically respect this configuration.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSave} className="space-y-6">
            {feedback && (
              <div
                className={`flex items-center gap-2 rounded-md p-3 text-sm ${
                  feedback.type === 'success'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-destructive/20 bg-destructive/10 text-destructive'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            {/* Types Selection List */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Permitted Types</Label>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {ALL_TYPES.map((type) => {
                  const isChecked = selectedTypes.includes(type);
                  return (
                    <label
                      key={type}
                      htmlFor={`type-checkbox-${type}`}
                      className={`border-border flex cursor-pointer items-center gap-3 rounded-lg border p-3.5 transition-colors ${
                        isChecked
                          ? 'border-primary/50 bg-primary/5'
                          : 'bg-muted/10 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <Checkbox
                        id={`type-checkbox-${type}`}
                        aria-label={type}
                        checked={isChecked}
                        onCheckedChange={(val) =>
                          handleToggleType(type, val === true)
                        }
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{type}</span>
                        <span className="text-muted-foreground text-xs">
                          {type === WorkItemTypeEnum.Epic && 'Top-level initiative'}
                          {type === WorkItemTypeEnum.Feature && 'Product capability'}
                          {type === WorkItemTypeEnum.Story && 'User story / deliverable'}
                          {type === WorkItemTypeEnum.Task && 'Standard work unit'}
                          {type === WorkItemTypeEnum.Issue && 'Bug or leaf work item'}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {existingConfig?.hierarchy &&
              Object.keys(existingConfig.hierarchy).length > 0 && (
                <div className="border-border/60 bg-muted/20 space-y-1 rounded-lg border p-3 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">
                    Jira Import Custom Hierarchy Active
                  </span>
                  <p>
                    This project uses a custom hierarchy defined during Jira import.
                  </p>
                </div>
              )}

            {/* Warning if types are being removed */}
            {hasRemovedTypes && (
              <div className="border-amber-500/20 bg-amber-500/10 flex items-start gap-3 rounded-lg border p-3.5 text-amber-800 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="space-y-1 text-xs">
                  <p className="font-semibold">
                    Work items will be migrated
                  </p>
                  <p>
                    Removing{' '}
                    <span className="font-bold">{removedTypes.join(', ')}</span>{' '}
                    will cause all existing items of those types in this project to fall back
                    to <span className="font-bold">Issue</span>. Any subtask relations that are
                    invalid under the new hierarchy will be cleared.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isSaving || selectedTypes.length === 0}
                size="sm"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
