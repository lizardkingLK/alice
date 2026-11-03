'use client';

import { useMemo, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Shapes,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  findDuplicateWorkItemTypeName,
  normalizeProjectWorkItemTypeDefs,
  projectTypeKeys,
  workItemTypeDisplayName,
  type ProjectWorkItemTypeDef,
  type WorkItemType,
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
import { WorkItemTypeCatalogEditor } from '@/app/projects/_components/work-item-type-catalog-editor';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { runLockedMutationOrThrow } from '@/lib/optimistic-lock/run-locked-mutation';
import { errorMessage } from '@/lib/errors/error-message';
import {
  catalogRevisionFromDefs,
  upsertWitCatalogProject,
} from '@/app/work-items/_helpers/wit-catalog-storage';

export type ProjectSettingsTabProps = {
  readonly project: Project;
  readonly isManagerOrAdmin: boolean;
  readonly userId?: string | null;
};

function defsEqual(
  left: readonly ProjectWorkItemTypeDef[],
  right: readonly ProjectWorkItemTypeDef[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = [...left].sort((a, b) => a.level - b.level);
  const sortedRight = [...right].sort((a, b) => a.level - b.level);
  return sortedLeft.every((def, index) => {
    const other = sortedRight[index];
    return (
      other &&
      def.key === other.key &&
      def.name === other.name &&
      def.icon === other.icon &&
      def.level === other.level &&
      (def.description ?? '') === (other.description ?? '')
    );
  });
}

export function ProjectSettingsTab({
  project,
  isManagerOrAdmin,
  userId = null,
}: Readonly<ProjectSettingsTabProps>) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { handleMutationError } = useOptimisticLock();

  const existingConfig =
    (project.workflow_config as ProjectWorkflowConfig | null) ?? null;
  const initialDefs = useMemo(
    () => normalizeProjectWorkItemTypeDefs(existingConfig?.work_item_types),
    [existingConfig?.work_item_types]
  );
  const initialKeys = useMemo(
    () => projectTypeKeys(initialDefs),
    [initialDefs]
  );

  const [defs, setDefs] = useState<ProjectWorkItemTypeDef[]>(initialDefs);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [pendingRemoveKey, setPendingRemoveKey] = useState<string | null>(null);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [preview, setPreview] =
    useState<WorkItemTypeRemovalPreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const selectedKeys = projectTypeKeys(defs);
  const removedTypes = initialKeys.filter((key) => !selectedKeys.includes(key));
  const hasRemovedTypes = removedTypes.length > 0;
  const isDirty = !defsEqual(defs, initialDefs);

  const applyRemove = (key: string) => {
    setDefs(
      defs
        .filter((def) => def.key !== key)
        .map((def, index) => ({ ...def, level: index }))
    );
    setPendingRemoveKey(null);
  };

  const handleCatalogChange = (next: ProjectWorkItemTypeDef[]) => {
    setFeedback(null);
    setDefs(next);
  };

  const handleRequestRemove = (key: string) => {
    setFeedback(null);
    if (initialKeys.includes(key)) {
      setPendingRemoveKey(key);
      return;
    }
    applyRemove(key);
  };

  const saveWithStrategies = async (
    strategies?: WorkItemTypeRemovalStrategy[]
  ) => {
    const hierarchy: Record<string, string | null> = {};
    const ordered = [...defs].sort((a, b) => a.level - b.level);
    for (let i = 0; i < ordered.length - 1; i++) {
      hierarchy[ordered[i]!.key] = ordered[i + 1]!.key;
    }

    const mergedWorkflowConfig: ProjectWorkflowConfig = {
      ...existingConfig,
      work_item_types: defs,
      hierarchy,
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

    if (userId) {
      upsertWitCatalogProject(userId, project.id, {
        revision: catalogRevisionFromDefs(defs),
        types: defs,
      });
    }

    return data;
  };

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (defs.length === 0) {
      setFeedback({
        type: 'error',
        text: 'Please configure at least one work-item type.',
      });
      return;
    }
    if (findDuplicateWorkItemTypeName(defs)) {
      setFeedback({
        type: 'error',
        text: 'Type names must be unique. Change a duplicate name.',
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
            selectedKeys
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
            Only Project Managers and Administrators can configure work-item
            types.
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
            <Shapes className="h-5 w-5" />
            Work-Item Types
          </CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Add, rename, and order types for this project. Hierarchy is a single
            chain by level.
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

            <WorkItemTypeCatalogEditor
              value={defs}
              onChange={handleCatalogChange}
              disabled={isSaving}
              onRequestRemove={handleRequestRemove}
              className="max-h-[min(60vh,36rem)] overflow-y-auto pr-1"
            />

            {existingConfig?.hierarchy &&
              Object.keys(existingConfig.hierarchy).length > 0 && (
                <div className="border-border/60 bg-muted/20 text-muted-foreground space-y-1 rounded-lg border p-3 text-xs">
                  <span className="text-foreground font-semibold">
                    Custom hierarchy active
                  </span>
                  <p>Levels on save refresh the project parent→child chain.</p>
                </div>
              )}

            {hasRemovedTypes && (
              <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-start gap-3 rounded-lg border p-3.5 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-semibold">
                    Existing items need a resolution strategy
                  </p>
                  <p className="text-destructive/90 leading-relaxed">
                    Removing{' '}
                    <span className="font-bold">{removedTypes.join(', ')}</span>{' '}
                    will prompt you to delete or convert each affected type when
                    you save.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-auto flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isSaving || defs.length === 0 || !isDirty}
                size="sm"
                title="Save types"
              >
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Types
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(pendingRemoveKey)}
        onOpenChange={(open) => !open && setPendingRemoveKey(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Remove {workItemTypeDisplayName(pendingRemoveKey, defs)} from this
              project?
            </DialogTitle>
            <DialogDescription>
              Existing work items of type{' '}
              <span className="font-semibold">
                {workItemTypeDisplayName(pendingRemoveKey, defs)}
              </span>{' '}
              must be deleted or converted when you save.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPendingRemoveKey(null)}
            >
              Keep type
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => pendingRemoveKey && applyRemove(pendingRemoveKey)}
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
        migrateTargets={selectedKeys as WorkItemType[]}
        remainingTypeDefs={defs}
        labelTypeDefs={initialDefs}
        projectId={project.id}
        isSubmitting={isSaving}
        onConfirm={handleStrategyConfirm}
      />
    </div>
  );
}
