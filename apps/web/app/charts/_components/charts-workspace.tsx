'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { LayoutItem } from 'react-grid-layout';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { BarChart3, Layers } from '@repo/ui/lib/icons';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  pickWorkspaceDefaultsDialogController,
  WorkspaceDefaultsDialogHost,
} from '@/app/board/_components/workspace-defaults-dialog-host';
import { WorkspaceDefaultsControls } from '@/app/board/_components/workspace-defaults-controls';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import { ChartsAddMenu } from '@/app/charts/_components/charts-add-widget-menu';
import {
  ChartsBoardCanvas,
  appendChartWidget,
  duplicateChartWidget,
  reconcileChartBoardLayout,
  removeChartWidget,
  renameChartWidget,
  updateChartWidgetFilters,
  updateChartWidgetLabelField,
  updateChartWidgetPieVariant,
  updateChartWidgetViewMode,
  updateChartWidgetDisplaySettings,
} from '@/app/charts/_components/charts-board-canvas';
import { ChartsSaveWorkspaceDialog } from '@/app/charts/_components/charts-save-workspace-dialog';
import { ChartsShareWorkspaceDialog } from '@/app/charts/_components/charts-share-workspace-dialog';
import { ChartsWorkspaceActionsMenu } from '@/app/charts/_components/charts-workspace-actions-menu';
import { isChartWidgetAvailable } from '@/app/charts/_components/charts-widget-catalog';
import type {
  ChartBoardWidgetInstance,
  ChartPieVariant,
  ChartsLabelFieldId,
  ChartWidgetDisplaySettingsPatch,
  ChartWidgetTypeId,
  ChartWidgetViewMode,
  ChartWorkspaceRecord,
} from '@/app/charts/_components/charts.types';
import type {
  ChartsSampleMember,
  ChartsWidgetFilterDraft,
} from '@/app/charts/_components/charts-sample.data';
import { DismissibleError } from '@/components/dismissible-error';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';
import { isSessionExpiredError } from '@/lib/errors/session-expired';
import {
  createChartWorkspace,
  getChartWorkspace,
  readChartWorkspacesStore,
  removeChartWorkspace,
  renameChartWorkspaceMeta,
  saveChartWorkspaceBoard,
  setLastOpenedChartWorkspace,
  suggestChartWorkspaceTitle,
} from '@/app/charts/_helpers/charts-workspace-storage';
import { hydrateChartWorkspacesFromApi } from '@/app/charts/_helpers/charts-workspace-hydrate';
import { chartsWorkspaceHref } from '@/app/charts/_helpers/charts-links';
import { createChartWidgetFiltersFromDefaults } from '@/app/charts/_helpers/charts-widget-defaults';
import { useChartsWorkspaceDefaults } from '@/app/charts/_hooks/use-charts-workspace-defaults';
import {
  archiveChartWorkspace,
  deleteChartWorkspace,
  leaveSharedChartWorkspace,
  restoreChartWorkspace,
  syncChartWorkspaceToApi,
} from '@/app/charts/_services/charts.mutations.client';
import { useDashboardEntityBreadcrumb } from '@/app/dashboard/_components/dashboard-breadcrumb-runtime';

type ChartsWorkspaceProps = {
  readonly workspaceId: string;
  readonly currentUserId: string;
  readonly focusWidgetId?: string;
  readonly shareProjects: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly assigneeMembers: readonly ChartsSampleMember[];
  readonly projects: readonly Project[];
  readonly sprints: readonly Sprint[];
  readonly suggestedDefaults: BoardDefaultsPreference | null;
};

export function ChartsWorkspace({
  workspaceId,
  currentUserId,
  focusWidgetId,
  shareProjects,
  assigneeMembers,
  projects,
  sprints,
  suggestedDefaults,
}: Readonly<ChartsWorkspaceProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [workspace, setWorkspace] = useState<ChartWorkspaceRecord | null>(null);
  const [instances, setInstances] = useState<ChartBoardWidgetInstance[]>([]);
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [deleteKind, setDeleteKind] = useState<'owned' | 'share' | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const deleteInFlightRef = useRef(false);

  const chartsDefaults = useChartsWorkspaceDefaults({
    userId: currentUserId,
    projects,
    sprints,
    suggestedDefaults,
  });

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      try {
        await hydrateChartWorkspacesFromApi(currentUserId);
      } catch {
        // Fall through — local cache may still have the workspace.
      }
      if (cancelled) {
        return;
      }

      const record = getChartWorkspace(currentUserId, workspaceId);
      if (!record) {
        const store = readChartWorkspacesStore(currentUserId);
        const fallback =
          store.workspaces.find((item) => item.status === 'active') ??
          store.workspaces[0];
        router.replace(fallback ? `/charts/${fallback.id}` : '/charts');
        return;
      }

      setLastOpenedChartWorkspace(currentUserId, record.id);
      setWorkspace(record);
      const reconciledLayout = reconcileChartBoardLayout(
        record.instances,
        record.layout
      );
      setInstances(record.instances);
      setLayout(reconciledLayout);
      setHydrated(true);
      if (
        reconciledLayout.length !== record.layout.length ||
        !reconciledLayout.every(
          (item, index) => item.i === record.layout[index]?.i
        )
      ) {
        syncChartWorkspaceToApi({
          ...record,
          layout: reconciledLayout,
        }).catch(() => {});
        saveChartWorkspaceBoard(currentUserId, record.id, {
          instances: record.instances,
          layout: reconciledLayout,
        });
      }
    }

    hydrate().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [currentUserId, router, workspaceId]);

  const persistBoard = useCallback(
    (nextInstances: ChartBoardWidgetInstance[], nextLayout: LayoutItem[]) => {
      const updated = saveChartWorkspaceBoard(currentUserId, workspaceId, {
        instances: nextInstances,
        layout: nextLayout,
      });
      if (updated) {
        setWorkspace(updated);
        syncChartWorkspaceToApi(updated).catch(() => {});
      }
    },
    [currentUserId, workspaceId]
  );

  const commitBoard = useCallback(
    (next: { instances: ChartBoardWidgetInstance[]; layout: LayoutItem[] }) => {
      const reconciledLayout = reconcileChartBoardLayout(
        next.instances,
        next.layout
      );
      setInstances(next.instances);
      setLayout(reconciledLayout);
      if (hydrated) {
        persistBoard(next.instances, reconciledLayout);
      }
    },
    [hydrated, persistBoard]
  );

  const commitInstances = useCallback(
    (nextInstances: ChartBoardWidgetInstance[]) => {
      setInstances(nextInstances);
      if (hydrated) {
        persistBoard(nextInstances, layout);
      }
    },
    [hydrated, layout, persistBoard]
  );

  const handleSelectWidget = useCallback(
    (typeId: ChartWidgetTypeId) => {
      if (!isChartWidgetAvailable(typeId)) {
        return;
      }
      const filters =
        typeId === 'chart'
          ? createChartWidgetFiltersFromDefaults(
              chartsDefaults.insertPreference
            )
          : undefined;
      commitBoard(
        appendChartWidget(typeId, instances, layout, {
          ...(filters ? { filters } : {}),
        })
      );
    },
    [chartsDefaults.insertPreference, commitBoard, instances, layout]
  );

  const handleAddWorkspace = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleCreateWorkspace = useCallback(
    async (payload: { title: string; isOverview: boolean }) => {
      const created = createChartWorkspace(currentUserId, {
        title: payload.title,
        isOverview: payload.isOverview,
      });
      try {
        await syncChartWorkspaceToApi(created);
      } catch (err) {
        if (isSessionExpiredError(err)) {
          return;
        }
      }
      router.push(`/charts/${created.id}`);
    },
    [currentUserId, router]
  );

  const handleSaveWorkspace = useCallback(
    (payload: { title: string; isOverview: boolean }) => {
      const updated = renameChartWorkspaceMeta(currentUserId, workspaceId, {
        title: payload.title,
        isOverview: payload.isOverview,
      });
      if (updated) {
        setWorkspace(updated);
        syncChartWorkspaceToApi(updated).catch(() => {});
      }
    },
    [currentUserId, workspaceId]
  );

  const handleArchiveWorkspace = useCallback(async () => {
    setActionError(null);
    try {
      await archiveChartWorkspace(workspaceId);
      const updated = renameChartWorkspaceMeta(currentUserId, workspaceId, {
        status: 'archived',
        isOverview: false,
      });
      if (updated) {
        setWorkspace(updated);
      }
    } catch (err) {
      if (isSessionExpiredError(err)) {
        return;
      }
      setActionError(
        err instanceof Error ? err.message : 'Failed to archive workspace'
      );
    }
  }, [currentUserId, workspaceId]);

  const handleRestoreWorkspace = useCallback(async () => {
    setActionError(null);
    try {
      await restoreChartWorkspace(workspaceId);
      const updated = renameChartWorkspaceMeta(currentUserId, workspaceId, {
        status: 'active',
      });
      if (updated) {
        setWorkspace(updated);
      }
    } catch (err) {
      if (isSessionExpiredError(err)) {
        return;
      }
      setActionError(
        err instanceof Error ? err.message : 'Failed to restore workspace'
      );
    }
  }, [currentUserId, workspaceId]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteKind || deleteInFlightRef.current) {
      return;
    }
    deleteInFlightRef.current = true;
    const kind = deleteKind;
    setDeletePending(true);
    setActionError(null);
    setDeleteKind(null);
    // Leave the board immediately; API runs in the background.
    removeChartWorkspace(currentUserId, workspaceId);
    router.replace('/charts');

    try {
      if (kind === 'share') {
        await leaveSharedChartWorkspace(workspaceId);
      } else {
        await deleteChartWorkspace(workspaceId);
      }
    } catch (err) {
      let message = 'Failed to delete workspace';
      if (err instanceof Error) {
        message = err.message;
      } else if (kind === 'share') {
        message = 'Failed to leave shared workspace';
      }
      // Surface on registry after navigation via query is heavier; console is enough
      // for board-level leave/delete failures once we already navigated away.
      console.error(message, err);
    } finally {
      setDeletePending(false);
      deleteInFlightRef.current = false;
    }
  }, [currentUserId, deleteKind, router, workspaceId]);

  const handleLayoutChange = useCallback(
    (nextLayout: LayoutItem[]) => {
      const reconciled = reconcileChartBoardLayout(instances, nextLayout);
      setLayout(reconciled);
      if (hydrated) {
        persistBoard(instances, reconciled);
      }
    },
    [hydrated, instances, persistBoard]
  );

  const handleRemoveWidget = useCallback(
    (instanceId: string) => {
      commitBoard(removeChartWidget(instanceId, instances, layout));
      if (focusWidgetId === instanceId) {
        router.replace(`/charts/${workspaceId}`);
      }
    },
    [commitBoard, focusWidgetId, instances, layout, router, workspaceId]
  );

  const handleDuplicateWidget = useCallback(
    (instanceId: string) => {
      commitBoard(duplicateChartWidget(instanceId, instances, layout));
    },
    [commitBoard, instances, layout]
  );

  const handleRenameWidget = useCallback(
    (instanceId: string, title: string) => {
      commitInstances(renameChartWidget(instanceId, title, instances));
    },
    [commitInstances, instances]
  );

  const handleFiltersChange = useCallback(
    (
      instanceId: string,
      filters: ChartsWidgetFilterDraft | null | undefined
    ) => {
      commitInstances(
        updateChartWidgetFilters(instanceId, filters ?? null, instances)
      );
    },
    [commitInstances, instances]
  );

  const handleViewModeChange = useCallback(
    (
      instanceId: string,
      viewMode: ChartWidgetViewMode,
      focusedSliceKey?: string | null
    ) => {
      commitInstances(
        updateChartWidgetViewMode(
          instanceId,
          viewMode,
          focusedSliceKey ?? null,
          instances
        )
      );
    },
    [commitInstances, instances]
  );

  const handlePieVariantChange = useCallback(
    (instanceId: string, pieVariant: ChartPieVariant) => {
      commitInstances(
        updateChartWidgetPieVariant(instanceId, pieVariant, instances)
      );
    },
    [commitInstances, instances]
  );

  const handleLabelFieldChange = useCallback(
    (instanceId: string, labelField: ChartsLabelFieldId) => {
      commitInstances(
        updateChartWidgetLabelField(instanceId, labelField, instances)
      );
    },
    [commitInstances, instances]
  );

  const handleDisplaySettingsChange = useCallback(
    (instanceId: string, patch: ChartWidgetDisplaySettingsPatch) => {
      commitInstances(
        updateChartWidgetDisplaySettings(instanceId, patch, instances)
      );
    },
    [commitInstances, instances]
  );

  const handleCloseWidgetDeepLink = useCallback(() => {
    if (!focusWidgetId) {
      return;
    }
    const query = searchParams.toString();
    router.replace(
      query ? `/charts/${workspaceId}?${query}` : `/charts/${workspaceId}`
    );
  }, [focusWidgetId, router, searchParams, workspaceId]);

  const createDefaultTitle = useMemo(
    () => suggestChartWorkspaceTitle(currentUserId),
    [currentUserId]
  );

  const saveDefaultTitle = useMemo(
    () => workspace?.title || createDefaultTitle,
    [createDefaultTitle, workspace?.title]
  );

  useDashboardEntityBreadcrumb({
    url: chartsWorkspaceHref(workspaceId),
    label: workspace?.title,
  });

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
      {actionError ? (
        <DismissibleError
          message={actionError}
          onDismiss={() => setActionError(null)}
        />
      ) : null}
      <div className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <Button asChild variant="outline" size="sm" className="h-9 gap-2">
            <Link href="/charts">
              <Layers className="size-3.5" data-icon="inline-start" />
              All workspaces
            </Link>
          </Button>
          <WorkspaceDefaultsControls
            onOpenDefaultsDialog={chartsDefaults.openDefaultsDialog}
            savedDefaultsApplied={chartsDefaults.savedDefaultsApplied}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start">
          <ChartsAddMenu
            onSelectWidget={handleSelectWidget}
            onAddWorkspace={handleAddWorkspace}
          />
        </div>
      </div>

      <Card className="border-border bg-card/50 flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden backdrop-blur-md">
        <CardHeader className="shrink-0 pb-3">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <CardTitle className="flex min-w-0 items-center gap-2 text-2xl font-bold tracking-tight">
                <BarChart3 className="text-primary size-5 shrink-0" />
                <TruncatedText className="min-w-0">
                  {workspace?.title ?? 'Charts'}
                </TruncatedText>
              </CardTitle>
              <CardDescription>
                Customize your board by arranging widgets. Workspaces sync to
                your account and are cached on this device.
              </CardDescription>
            </div>
            {workspace ? (
              <ChartsWorkspaceActionsMenu
                ownership={workspace.ownership ?? 'mine'}
                status={workspace.status}
                onShare={() => setShareDialogOpen(true)}
                onRename={() => setSaveDialogOpen(true)}
                onArchive={() => void handleArchiveWorkspace()}
                onRestore={() => void handleRestoreWorkspace()}
                onRequestDelete={() =>
                  setDeleteKind(
                    (workspace.ownership ?? 'mine') === 'shared'
                      ? 'share'
                      : 'owned'
                  )
                }
              />
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto pt-2 pb-2">
          <ChartsBoardCanvas
            instances={instances}
            layout={layout}
            hydrated={hydrated}
            focusWidgetId={focusWidgetId}
            accessibleProjects={shareProjects}
            accessibleSprints={sprints.flatMap((sprint) =>
              sprint.project?.id
                ? [
                    {
                      id: sprint.id,
                      name: sprint.name,
                      projectId: sprint.project.id,
                    },
                  ]
                : []
            )}
            assigneeMembers={assigneeMembers}
            onLayoutChange={handleLayoutChange}
            onRemoveWidget={handleRemoveWidget}
            onDuplicateWidget={handleDuplicateWidget}
            onRenameWidget={handleRenameWidget}
            onFiltersChange={handleFiltersChange}
            onViewModeChange={handleViewModeChange}
            onPieVariantChange={handlePieVariantChange}
            onLabelFieldChange={handleLabelFieldChange}
            onDisplaySettingsChange={handleDisplaySettingsChange}
            onFocusWidgetDismiss={handleCloseWidgetDeepLink}
          />
        </CardContent>
      </Card>

      <ChartsSaveWorkspaceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        defaultTitle={createDefaultTitle}
        initialIsOverview={false}
        onSave={handleCreateWorkspace}
      />
      <ChartsSaveWorkspaceDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        mode="save"
        defaultTitle={saveDefaultTitle}
        initialIsOverview={workspace?.isOverview ?? false}
        onSave={handleSaveWorkspace}
      />
      <ChartsShareWorkspaceDialog
        open={shareDialogOpen}
        onOpenChange={setShareDialogOpen}
        workspace={workspace}
        projects={shareProjects}
        currentUserId={currentUserId}
      />
      {deleteKind ? (
        <RegistryConfirmDialog
          title={
            deleteKind === 'share'
              ? 'Leave shared workspace'
              : 'Permanently delete workspace'
          }
          subject={workspace?.title ?? 'this workspace'}
          detail={
            deleteKind === 'share'
              ? 'This removes the workspace from Shared with me only. The owner’s copy is unchanged, and they can share it with you again later.'
              : 'This action is irreversible. The chart workspace, its board layout, and any share records linked to it will be permanently removed. The matching Views bookmark is removed as well.'
          }
          confirmLabel={deleteKind === 'share' ? 'Leave' : 'Delete'}
          pendingLabel={deleteKind === 'share' ? 'Leaving...' : 'Deleting...'}
          isPending={deletePending}
          isSoft={false}
          actionVerb={deleteKind === 'share' ? 'leave' : undefined}
          onCancel={() => setDeleteKind(null)}
          onConfirm={() => void handleConfirmDelete()}
        />
      ) : null}
      <WorkspaceDefaultsDialogHost
        enabled
        projects={projects}
        sprints={sprints}
        defaults={pickWorkspaceDefaultsDialogController(chartsDefaults)}
        showAllProjectsOption
      />
    </div>
  );
}
