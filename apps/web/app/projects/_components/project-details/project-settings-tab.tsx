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
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Settings,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  CANONICAL_HIERARCHY_ORDER,
  type WorkItemType,
  WorkItemTypeEnum,
  type WorkItemTypeRemovalPreviewResponse,
  type WorkItemTypeRemovalStrategy,
} from '@repo/types';
import type { ProjectWorkflowConfig } from '@repo/types/api/v1';
import {
  previewWorkItemTypeRemoval,
  updateProject,
  type Project,
} from '@/app/projects/_services/projects.mutations.client';
import { ProjectTypeRemovalStrategyDialog } from '@/app/projects/_components/project-details/project-type-removal-strategy-dialog';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { runLockedMutationOrThrow } from '@/lib/optimistic-lock/run-locked-mutation';
import { errorMessage } from '@/lib/errors/error-message';
import {
  WORK_ITEM_TYPE_BADGE_STYLES,
  WORK_ITEM_TYPE_ICONS,
} from '@/app/work-items/_helpers/work-item-type';

export type ProjectSettingsTabProps = {
  readonly project: Project;
  readonly isManagerOrAdmin: boolean;
};

const ALL_TYPES: readonly WorkItemType[] = CANONICAL_HIERARCHY_ORDER;

const TYPE_DESCRIPTIONS: Record<WorkItemType, string> = {
  [WorkItemTypeEnum.Epic]: 'Top-level initiative',
  [WorkItemTypeEnum.Feature]: 'Product capability',
  [WorkItemTypeEnum.Story]: 'User story / deliverable',
  [WorkItemTypeEnum.Task]: 'Standard work unit',
  [WorkItemTypeEnum.Issue]: 'Bug or leaf work item',
};

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

  const [selectedTypes, setSelectedTypes] =
    useState<WorkItemType[]>(initialTypes);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [pendingUncheck, setPendingUncheck] = useState<WorkItemType | null>(
    null
  );
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [preview, setPreview] =
    useState<WorkItemTypeRemovalPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const removedTypes = initialTypes.filter((t) => !selectedTypes.includes(t));
  const hasRemovedTypes = removedTypes.length > 0;
  const isDirty =
    selectedTypes.length !== initialTypes.length ||
    selectedTypes.some((type) => !initialTypes.includes(type));

  const applyUncheck = (type: WorkItemType) => {
    setSelectedTypes(selectedTypes.filter((t) => t !== type));
    setPendingUncheck(null);
  };

  const handleToggleType = (type: WorkItemType, checked: boolean) => {
    setFeedback(null);
    if (checked) {
      const next = ALL_TYPES.filter(
        (t) => t === type || selectedTypes.includes(t)
      );
      setSelectedTypes(next);
      return;
    }

    if (initialTypes.includes(type)) {
      setPendingUncheck(type);
      return;
    }

    applyUncheck(type);
  };

  const saveWithStrategies = async (
    strategies?: WorkItemTypeRemovalStrategy[]
  ) => {
    const mergedWorkflowConfig: ProjectWorkflowConfig = {
      ...existingConfig,
      work_item_types: selectedTypes,
    };

    const pendingFields: Record<string, unknown> = {
      workflow_config: mergedWorkflowConfig,
    };
    if (strategies && strategies.length > 0) {
      pendingFields.typeRemovalStrategies = strategies;
    }

    const data = await runLockedMutationOrThrow({
      mutate: () =>
        updateProject(
          project.id,
          pendingFields as Parameters<typeof updateProject>[1],
          project.updated_at
        ),
      handleMutationError,
      entityType: 'project',
      entityId: project.id,
      expectedUpdatedAt: project.updated_at,
      pendingFields,
    });

    return data;
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

    try {
      if (hasRemovedTypes) {
        setPreviewLoading(true);
        setPreviewError(null);
        setStrategyOpen(true);
        try {
          const nextPreview = await previewWorkItemTypeRemoval(
            project.id,
            removedTypes,
            selectedTypes
          );
          setPreview(nextPreview);
          if (nextPreview.totalAffected === 0) {
            setStrategyOpen(false);
            await saveWithStrategies();
            setFeedback({
              type: 'success',
              text: 'Project work-item types updated successfully.',
            });
            startTransition(() => {
              router.refresh();
            });
            return;
          }
        } catch (err) {
          setPreviewError(
            errorMessage(err, 'Failed to load affected work items.')
          );
        } finally {
          setPreviewLoading(false);
          setIsSaving(false);
        }
        return;
      }

      await saveWithStrategies();
      setFeedback({
        type: 'success',
        text: 'Project work-item types updated successfully.',
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

  const handleStrategyConfirm = async (
    strategies: WorkItemTypeRemovalStrategy[]
  ) => {
    setIsSaving(true);
    setFeedback(null);
    try {
      await saveWithStrategies(strategies);
      setStrategyOpen(false);
      setFeedback({
        type: 'success',
        text: 'Work-item types updated. Existing items were handled per your choices.',
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
      <Card className="border-border/60 h-full w-full">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground text-sm">
            Only Project Managers and Administrators can configure project
            settings.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col">
      <Card className="border-border/60 flex h-full min-h-0 w-full flex-1 flex-col shadow-sm">
        <CardHeader>
          <CardTitle className="text-primary flex items-center gap-2 text-base font-semibold">
            <Settings className="h-5 w-5" />
            Allowed Work-Item Types
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Configure which work-item types are permitted in this project.
            Subtasks and forms will automatically respect this configuration.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col">
          <form
            onSubmit={handleSave}
            className="flex min-h-0 flex-1 flex-col gap-6"
          >
            {feedback && (
              <div
                className={cn(
                  'flex items-center gap-2 rounded-md border p-3 text-sm',
                  feedback.type === 'success'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                    : 'border-destructive/20 bg-destructive/10 text-destructive'
                )}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                ) : (
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-sm font-medium">Permitted Types</Label>
              <div className="flex flex-col gap-3">
                {ALL_TYPES.map((type) => {
                  const isChecked = selectedTypes.includes(type);
                  const Icon = WORK_ITEM_TYPE_ICONS[type];
                  return (
                    <label
                      key={type}
                      htmlFor={`type-checkbox-${type}`}
                      className={cn(
                        'border-border flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition-colors',
                        isChecked
                          ? 'border-primary/40 bg-primary/5'
                          : 'bg-muted/10 hover:bg-muted/20'
                      )}
                    >
                      <div
                        className={cn(
                          'flex size-12 shrink-0 items-center justify-center rounded-xl border',
                          WORK_ITEM_TYPE_BADGE_STYLES[type]
                        )}
                      >
                        <Icon className="size-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="text-foreground text-base font-semibold">
                          {type}
                        </span>
                        <p className="text-muted-foreground text-sm">
                          {TYPE_DESCRIPTIONS[type]}
                        </p>
                      </div>
                      <Checkbox
                        id={`type-checkbox-${type}`}
                        aria-label={type}
                        checked={isChecked}
                        onCheckedChange={(val) =>
                          handleToggleType(type, val === true)
                        }
                        className="size-5"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {existingConfig?.hierarchy &&
              Object.keys(existingConfig.hierarchy).length > 0 && (
                <div className="border-border/60 bg-muted/20 text-muted-foreground space-y-1 rounded-lg border p-3 text-xs">
                  <span className="text-foreground font-semibold">
                    Jira Import Custom Hierarchy Active
                  </span>
                  <p>
                    This project uses a custom hierarchy defined during Jira
                    import.
                  </p>
                </div>
              )}

            {hasRemovedTypes && (
              <div className="flex items-start gap-3 rounded-lg border border-amber-700/30 bg-amber-100 p-3.5 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-800 dark:text-amber-300" />
                <div className="space-y-1">
                  <p className="font-semibold text-amber-950 dark:text-amber-50">
                    Existing items need a resolution strategy
                  </p>
                  <p className="text-amber-900 dark:text-amber-100/90">
                    Removing{' '}
                    <span className="font-bold">{removedTypes.join(', ')}</span>{' '}
                    will prompt you to delete or convert each affected type when
                    you save. Parent links that would become invalid are
                    detached first.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-auto flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isSaving || selectedTypes.length === 0 || !isDirty}
                size="sm"
                title="Save settings"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(pendingUncheck)}
        onOpenChange={(open) => !open && setPendingUncheck(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Remove {pendingUncheck} from this project?
            </DialogTitle>
            <DialogDescription>
              Existing work items of type{' '}
              <span className="font-semibold">{pendingUncheck}</span> must be
              deleted or converted when you save. You will choose the strategy
              for each removed type in the next step.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingUncheck(null)}
            >
              Keep type
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => pendingUncheck && applyUncheck(pendingUncheck)}
            >
              Remove type
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProjectTypeRemovalStrategyDialog
        open={strategyOpen}
        onOpenChange={setStrategyOpen}
        preview={preview}
        previewLoading={previewLoading}
        previewError={previewError}
        migrateTargets={selectedTypes}
        isSubmitting={isSaving}
        onConfirm={handleStrategyConfirm}
      />
    </div>
  );
}
