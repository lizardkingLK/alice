'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { BarChart3, Info, Loader2, GitFork } from '@repo/ui/lib/icons';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
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
  saveChartWidgetMeta,
  updateChartWidgetFilters,
  updateChartWidgetLabelField,
  updateChartWidgetPieVariant,
  updateChartWidgetViewMode,
  updateChartWidgetDisplaySettings,
} from '@/app/charts/_components/charts-board-canvas';
import {
  ChartsSaveWorkspaceDialog,
  type ChartsSaveWorkspacePayload,
} from '@/app/charts/_components/charts-save-workspace-dialog';
import { ChartsWorkspaceActionsMenu } from '@/app/charts/_components/charts-workspace-actions-menu';
import { ChartsWorkspaceFilterDialog } from '@/app/charts/_components/charts-workspace-filter-dialog';
import {
  ChartsWidgetScopeDialog,
  type ChartsWidgetScopeSelection,
} from '@/app/charts/_components/charts-widget-scope-dialog';
import { BurndownScopeLabels } from '@/components/burndown-scope-labels';
import { isChartWidgetAvailable } from '@/app/charts/_components/charts-widget-catalog';
import { resolveChartsDescription } from '@/app/charts/_helpers/charts-description';
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
import { writeChartsLastOpenedId } from '@/app/charts/_helpers/charts-last-opened';
import { chartsWorkspaceHref } from '@/app/charts/_helpers/charts-links';
import {
  boardFilterFromPreference,
  clearInstanceScopeLocks,
  filtersFromBoardSelection,
  isWorkspaceScoped,
  resolveChartWidgetInsertAction,
  type ChartsBoardFilterSelection,
} from '@/app/charts/_helpers/charts-widget-scope';
import {
  clearLegacyChartsLocalStorage,
  suggestChartWorkspaceTitle,
} from '@/app/charts/_helpers/charts-workspace-utils';
import {
  chartOwnershipForViewer,
  chartWorkspaceFromApiRow,
} from '@/app/charts/_helpers/charts-workspace-map';
import { useChartsWorkspaceDefaults } from '@/app/charts/_hooks/use-charts-workspace-defaults';
import {
  archiveChartWorkspace,
  createChartWorkspaceOnApi,
  deleteChartWorkspace,
  forkChartWorkspaceOnApi,
  leaveSharedChartWorkspace,
  restoreChartWorkspace,
  syncChartWorkspaceToApi,
} from '@/app/charts/_services/charts.mutations.client';
import { useDashboardEntityBreadcrumb } from '@/app/dashboard/_components/dashboard-breadcrumb-runtime';

type ChartsWorkspaceProps = {
  readonly workspaceId: string;
  readonly currentUserId: string;
  readonly focusWidgetId?: string;
  readonly initialWorkspace: ChartWorkspaceRecord;
  readonly shareProjects: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  readonly assigneeMembers: readonly ChartsSampleMember[];
  readonly projects: readonly Project[];
  readonly sprints: readonly Sprint[];
};

function reportWorkspaceActionError(
  err: unknown,
  fallback: string,
  // eslint-disable-next-line no-unused-vars -- setter
  setActionError: (message: string | null) => void
): void {
  if (isSessionExpiredError(err)) {
    return;
  }
  setActionError(err instanceof Error ? err.message : fallback);
}

function markWorkspaceNonScoped(
  previous: ChartWorkspaceRecord
): ChartWorkspaceRecord | null {
  if (!previous.scope) {
    return null;
  }
  return {
    ...previous,
    scope: null,
    instances: clearInstanceScopeLocks(previous.instances),
    updatedAt: new Date().toISOString(),
  };
}

export function ChartsWorkspace({
  workspaceId,
  currentUserId,
  focusWidgetId,
  initialWorkspace,
  shareProjects,
  assigneeMembers,
  projects,
  sprints,
}: Readonly<ChartsWorkspaceProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [workspace, setWorkspace] = useState<ChartWorkspaceRecord | null>(
    initialWorkspace
  );
  const [instances, setInstances] = useState<ChartBoardWidgetInstance[]>(
    () => initialWorkspace.instances
  );
  const [layout, setLayout] = useState<LayoutItem[]>(() =>
    reconcileChartBoardLayout(
      initialWorkspace.instances,
      initialWorkspace.layout
    )
  );
  const [hydrated] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteKind, setDeleteKind] = useState<'owned' | 'share' | null>(null);
  const [deletePending, setDeletePending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [savingCount, setSavingCount] = useState(0);
  const deleteInFlightRef = useRef(false);
  const isSaving = savingCount > 0;

  const runWorkspaceSync = useCallback(async (next: ChartWorkspaceRecord) => {
    setSavingCount((count) => count + 1);
    try {
      await syncChartWorkspaceToApi(next);
    } finally {
      setSavingCount((count) => Math.max(0, count - 1));
    }
  }, []);

  const { savedPreference, saveDefaults } = useChartsWorkspaceDefaults({
    userId: currentUserId,
    projects,
    sprints,
  });

  const [activeBoardFilter, setActiveBoardFilter] =
    useState<ChartsBoardFilterSelection>(() =>
      boardFilterFromPreference(savedPreference)
    );

  useEffect(() => {
    setActiveBoardFilter(boardFilterFromPreference(savedPreference));
  }, [savedPreference]);

  const workspaceScoped = isWorkspaceScoped(workspace);

  const accessibleSprints = useMemo(
    () =>
      sprints.flatMap((sprint) =>
        sprint.project?.id
          ? [
              {
                id: sprint.id,
                name: sprint.name,
                projectId: sprint.project.id,
              },
            ]
          : []
      ),
    [sprints]
  );

  useEffect(() => {
    clearLegacyChartsLocalStorage(currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    writeChartsLastOpenedId(initialWorkspace.id);

    const reconciledLayout = reconcileChartBoardLayout(
      initialWorkspace.instances,
      initialWorkspace.layout
    );
    setWorkspace(initialWorkspace);
    setInstances(initialWorkspace.instances);
    setLayout(reconciledLayout);

    if (
      reconciledLayout.length !== initialWorkspace.layout.length ||
      !reconciledLayout.every(
        (item, index) => item.i === initialWorkspace.layout[index]?.i
      )
    ) {
      const repaired = {
        ...initialWorkspace,
        layout: reconciledLayout,
      };
      setWorkspace(repaired);
      runWorkspaceSync(repaired).catch(() => {});
    }
  }, [initialWorkspace, runWorkspaceSync]);

  const persistBoard = useCallback(
    (nextInstances: ChartBoardWidgetInstance[], nextLayout: LayoutItem[]) => {
      setWorkspace((previous) => {
        if (!previous) {
          return previous;
        }
        const updated: ChartWorkspaceRecord = {
          ...previous,
          instances: nextInstances,
          layout: nextLayout,
          updatedAt: new Date().toISOString(),
        };
        runWorkspaceSync(updated).catch(() => {});
        return updated;
      });
    },
    [runWorkspaceSync]
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

  /** Mixed burndown insert when Filter lacks project and/or sprint. */
  const [pendingBurndownTypeId, setPendingBurndownTypeId] =
    useState<ChartWidgetTypeId | null>(null);

  const insertWidgetWithFilters = useCallback(
    (typeId: ChartWidgetTypeId, filters: ChartsWidgetFilterDraft) => {
      commitBoard(
        appendChartWidget(typeId, instances, layout, {
          filters,
        })
      );
    },
    [commitBoard, instances, layout]
  );

  const handleSelectWidget = useCallback(
    (typeId: ChartWidgetTypeId) => {
      if (!isChartWidgetAvailable(typeId)) {
        return;
      }

      const action = resolveChartWidgetInsertAction({
        typeId,
        workspaceScope: workspace?.scope,
        activeBoardFilter,
      });

      if (action.type === 'prompt-burndown') {
        setPendingBurndownTypeId(typeId);
        return;
      }
      if (action.type === 'append-filters') {
        insertWidgetWithFilters(typeId, action.filters);
        return;
      }
      commitBoard(appendChartWidget(typeId, instances, layout));
    },
    [
      activeBoardFilter,
      commitBoard,
      insertWidgetWithFilters,
      instances,
      layout,
      workspace?.scope,
    ]
  );

  const handleConfirmBurndownScope = useCallback(
    (scope: ChartsWidgetScopeSelection) => {
      if (!pendingBurndownTypeId) {
        return;
      }
      const typeId = pendingBurndownTypeId;
      setPendingBurndownTypeId(null);
      insertWidgetWithFilters(
        typeId,
        filtersFromBoardSelection({
          projectId: scope.projectId,
          sprintId: scope.sprintId,
        })
      );
    },
    [insertWidgetWithFilters, pendingBurndownTypeId]
  );

  const handleAddWorkspace = useCallback(() => {
    setCreateDialogOpen(true);
  }, []);

  const handleForkWorkspace = useCallback(async () => {
    setActionError(null);
    try {
      const forked = await forkChartWorkspaceOnApi({
        chartId: workspaceId,
        viewerId: currentUserId,
      });
      router.push(`/charts/${forked.id}`);
    } catch (err) {
      reportWorkspaceActionError(
        err,
        'Failed to fork workspace',
        setActionError
      );
    }
  }, [currentUserId, router, workspaceId]);

  const handleMarkNonScoped = useCallback(() => {
    setWorkspace((previous) => {
      if (!previous) {
        return previous;
      }
      const updated = markWorkspaceNonScoped(previous);
      if (!updated) {
        return previous;
      }
      setInstances(updated.instances);
      runWorkspaceSync(updated).catch(() => {});
      return updated;
    });
  }, [runWorkspaceSync]);

  const handleCreateWorkspace = useCallback(
    async (payload: ChartsSaveWorkspacePayload) => {
      setActionError(null);
      try {
        const created = await createChartWorkspaceOnApi({
          title: payload.title,
          description: payload.description,
          scope: payload.scope ?? null,
          viewerId: currentUserId,
        });
        router.push(`/charts/${created.id}`);
      } catch (err) {
        reportWorkspaceActionError(
          err,
          'Failed to create workspace',
          setActionError
        );
        throw err instanceof Error
          ? err
          : new Error('Failed to create workspace');
      }
    },
    [currentUserId, router]
  );

  const handleSaveWorkspace = useCallback(
    (payload: ChartsSaveWorkspacePayload) => {
      setWorkspace((previous) => {
        if (!previous) {
          return previous;
        }
        const updated: ChartWorkspaceRecord = {
          ...previous,
          title: payload.title.trim() || previous.title,
          description: payload.description,
          updatedAt: new Date().toISOString(),
        };
        runWorkspaceSync(updated).catch(() => {});
        return updated;
      });
    },
    [runWorkspaceSync]
  );

  const handleArchiveWorkspace = useCallback(async () => {
    setActionError(null);
    try {
      const row = await archiveChartWorkspace(workspaceId);
      setWorkspace(
        chartWorkspaceFromApiRow(
          row,
          chartOwnershipForViewer(row, currentUserId)
        )
      );
    } catch (err) {
      reportWorkspaceActionError(
        err,
        'Failed to archive workspace',
        setActionError
      );
    }
  }, [currentUserId, workspaceId]);

  const handleRestoreWorkspace = useCallback(async () => {
    setActionError(null);
    try {
      const row = await restoreChartWorkspace(workspaceId);
      setWorkspace(
        chartWorkspaceFromApiRow(
          row,
          chartOwnershipForViewer(row, currentUserId)
        )
      );
    } catch (err) {
      reportWorkspaceActionError(
        err,
        'Failed to restore workspace',
        setActionError
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
    router.replace('/charts');

    try {
      if (kind === 'share') {
        await leaveSharedChartWorkspace(workspaceId);
      } else {
        await deleteChartWorkspace(workspaceId);
      }
    } catch (err) {
      const fallback =
        kind === 'share'
          ? 'Failed to leave shared workspace'
          : 'Failed to delete workspace';
      console.error(err instanceof Error ? err.message : fallback, err);
    } finally {
      setDeletePending(false);
      deleteInFlightRef.current = false;
    }
  }, [deleteKind, router, workspaceId]);

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

  const handleSaveWidgetMeta = useCallback(
    (
      instanceId: string,
      meta: { readonly title: string; readonly description: string | null }
    ) => {
      commitInstances(saveChartWidgetMeta(instanceId, meta, instances));
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
    () => suggestChartWorkspaceTitle(workspace?.title ? [workspace.title] : []),
    [workspace?.title]
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
    <ChartsWorkspaceView
      actionError={actionError}
      onDismissError={() => setActionError(null)}
      workspace={workspace}
      workspaceScoped={workspaceScoped}
      shareProjects={shareProjects}
      accessibleSprints={accessibleSprints}
      projects={projects}
      sprints={sprints}
      activeBoardFilter={activeBoardFilter}
      onApplyFilter={setActiveBoardFilter}
      onSaveWorkspaceDefaults={saveDefaults}
      isSaving={isSaving}
      onForkWorkspace={() => void handleForkWorkspace()}
      onSelectWidget={handleSelectWidget}
      onAddWorkspace={handleAddWorkspace}
      instances={instances}
      layout={layout}
      hydrated={hydrated}
      focusWidgetId={focusWidgetId}
      assigneeMembers={assigneeMembers}
      onLayoutChange={handleLayoutChange}
      onRemoveWidget={handleRemoveWidget}
      onDuplicateWidget={handleDuplicateWidget}
      onRenameWidget={handleSaveWidgetMeta}
      onFiltersChange={handleFiltersChange}
      onViewModeChange={handleViewModeChange}
      onPieVariantChange={handlePieVariantChange}
      onLabelFieldChange={handleLabelFieldChange}
      onDisplaySettingsChange={handleDisplaySettingsChange}
      onFocusWidgetDismiss={handleCloseWidgetDeepLink}
      onRenameWorkspace={() => setSaveDialogOpen(true)}
      onMarkNonScoped={handleMarkNonScoped}
      onArchiveWorkspace={() => void handleArchiveWorkspace()}
      onRestoreWorkspace={() => void handleRestoreWorkspace()}
      onRequestDelete={(kind) => setDeleteKind(kind)}
      pendingBurndownTypeId={pendingBurndownTypeId}
      onPendingBurndownOpenChange={(open) => {
        if (!open) {
          setPendingBurndownTypeId(null);
        }
      }}
      onConfirmBurndownScope={handleConfirmBurndownScope}
      createDialogOpen={createDialogOpen}
      onCreateDialogOpenChange={setCreateDialogOpen}
      createDefaultTitle={createDefaultTitle}
      onCreateWorkspace={handleCreateWorkspace}
      saveDialogOpen={saveDialogOpen}
      onSaveDialogOpenChange={setSaveDialogOpen}
      saveDefaultTitle={saveDefaultTitle}
      onSaveWorkspace={handleSaveWorkspace}
      deleteKind={deleteKind}
      deletePending={deletePending}
      onCancelDelete={() => setDeleteKind(null)}
      onConfirmDelete={() => void handleConfirmDelete()}
    />
  );
}

type ChartsWorkspaceViewProps = {
  readonly actionError: string | null;
  readonly onDismissError: () => void;
  readonly workspace: ChartWorkspaceRecord | null;
  readonly workspaceScoped: boolean;
  readonly shareProjects: ChartsWorkspaceProps['shareProjects'];
  readonly accessibleSprints: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly projectId: string;
  }>;
  readonly projects: readonly Project[];
  readonly sprints: readonly Sprint[];
  readonly activeBoardFilter: ChartsBoardFilterSelection;
  // eslint-disable-next-line no-unused-vars
  readonly onApplyFilter: (selection: ChartsBoardFilterSelection) => void;
  readonly onSaveWorkspaceDefaults: (
    // eslint-disable-next-line no-unused-vars
    preference: BoardDefaultsPreference | null
  ) => void;
  readonly isSaving: boolean;
  readonly onForkWorkspace: () => void;
  // eslint-disable-next-line no-unused-vars
  readonly onSelectWidget: (typeId: ChartWidgetTypeId) => void;
  readonly onAddWorkspace: () => void;
  readonly instances: ChartBoardWidgetInstance[];
  readonly layout: LayoutItem[];
  readonly hydrated: boolean;
  readonly focusWidgetId?: string;
  readonly assigneeMembers: readonly ChartsSampleMember[];
  // eslint-disable-next-line no-unused-vars
  readonly onLayoutChange: (next: LayoutItem[]) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onRemoveWidget: (instanceId: string) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onDuplicateWidget: (instanceId: string) => void;
  readonly onRenameWidget: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    meta: { readonly title: string; readonly description: string | null }
  ) => void;
  readonly onFiltersChange: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    filters: ChartsWidgetFilterDraft | null | undefined
  ) => void;
  readonly onViewModeChange: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    viewMode: ChartWidgetViewMode,
    // eslint-disable-next-line no-unused-vars
    focusedSliceKey?: string | null
  ) => void;
  readonly onPieVariantChange: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    pieVariant: ChartPieVariant
  ) => void;
  readonly onLabelFieldChange: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    labelField: ChartsLabelFieldId
  ) => void;
  readonly onDisplaySettingsChange: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    patch: ChartWidgetDisplaySettingsPatch
  ) => void;
  readonly onFocusWidgetDismiss: () => void;
  readonly onRenameWorkspace: () => void;
  readonly onMarkNonScoped: () => void;
  readonly onArchiveWorkspace: () => void;
  readonly onRestoreWorkspace: () => void;
  // eslint-disable-next-line no-unused-vars
  readonly onRequestDelete: (kind: 'owned' | 'share') => void;
  readonly pendingBurndownTypeId: ChartWidgetTypeId | null;
  // eslint-disable-next-line no-unused-vars
  readonly onPendingBurndownOpenChange: (open: boolean) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onConfirmBurndownScope: (scope: ChartsWidgetScopeSelection) => void;
  readonly createDialogOpen: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onCreateDialogOpenChange: (open: boolean) => void;
  readonly createDefaultTitle: string;
  // eslint-disable-next-line no-unused-vars
  readonly onCreateWorkspace: (payload: ChartsSaveWorkspacePayload) => void;
  readonly saveDialogOpen: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onSaveDialogOpenChange: (open: boolean) => void;
  readonly saveDefaultTitle: string;
  // eslint-disable-next-line no-unused-vars
  readonly onSaveWorkspace: (payload: ChartsSaveWorkspacePayload) => void;
  readonly deleteKind: 'owned' | 'share' | null;
  readonly deletePending: boolean;
  readonly onCancelDelete: () => void;
  readonly onConfirmDelete: () => void;
};

function ChartsWorkspaceBoardFilter(props: {
  readonly workspaceScoped: boolean;
  readonly scope: ChartWorkspaceRecord['scope'];
  readonly shareProjects: ChartsWorkspaceProps['shareProjects'];
  readonly accessibleSprints: ChartsWorkspaceViewProps['accessibleSprints'];
  readonly projects: readonly Project[];
  readonly sprints: readonly Sprint[];
  readonly activeBoardFilter: ChartsBoardFilterSelection;
  // eslint-disable-next-line no-unused-vars
  readonly onApplyFilter: (selection: ChartsBoardFilterSelection) => void;
  readonly onSaveWorkspaceDefaults: ChartsWorkspaceViewProps['onSaveWorkspaceDefaults'];
}) {
  if (props.workspaceScoped && props.scope) {
    return (
      <BurndownScopeLabels
        projectName={
          props.shareProjects.find((p) => p.id === props.scope?.projectId)
            ?.name ?? null
        }
        sprintName={
          props.accessibleSprints.find((s) => s.id === props.scope?.sprintId)
            ?.name ?? null
        }
        className="justify-start"
      />
    );
  }

  return (
    <ChartsWorkspaceFilterDialog
      projects={props.projects}
      sprints={props.sprints}
      activeFilter={props.activeBoardFilter}
      onApplyFilter={props.onApplyFilter}
      onSaveWorkspaceDefaults={props.onSaveWorkspaceDefaults}
    />
  );
}

function ChartsWorkspaceDeleteDialog(props: {
  readonly deleteKind: 'owned' | 'share';
  readonly title: string;
  readonly deletePending: boolean;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}) {
  const isShare = props.deleteKind === 'share';
  return (
    <RegistryConfirmDialog
      title={
        isShare ? 'Leave shared workspace' : 'Permanently delete workspace'
      }
      subject={props.title}
      detail={
        isShare
          ? 'This removes your access to this board only. The owner’s copy is unchanged. If you still have a Views entry for this board, leave or delete that share from Views as well.'
          : 'This action is irreversible. The chart workspace, its board layout, and any share records linked to it will be permanently removed.'
      }
      confirmLabel={isShare ? 'Leave' : 'Delete'}
      pendingLabel={isShare ? 'Leaving...' : 'Deleting...'}
      isPending={props.deletePending}
      isSoft={false}
      actionVerb={isShare ? 'leave' : undefined}
      onCancel={props.onCancel}
      onConfirm={props.onConfirm}
    />
  );
}

function ChartsWorkspaceView(props: Readonly<ChartsWorkspaceViewProps>) {
  const ownership = props.workspace?.ownership ?? 'mine';

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4">
      {props.actionError ? (
        <DismissibleError
          message={props.actionError}
          onDismiss={props.onDismissError}
        />
      ) : null}
      <div className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <ChartsWorkspaceBoardFilter
            workspaceScoped={props.workspaceScoped}
            scope={props.workspace?.scope}
            shareProjects={props.shareProjects}
            accessibleSprints={props.accessibleSprints}
            projects={props.projects}
            sprints={props.sprints}
            activeBoardFilter={props.activeBoardFilter}
            onApplyFilter={props.onApplyFilter}
            onSaveWorkspaceDefaults={props.onSaveWorkspaceDefaults}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start">
          {props.isSaving ? (
            <div
              className="text-muted-foreground flex items-center gap-2 text-sm"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="size-4 animate-spin" aria-hidden />
              <span>Saving…</span>
            </div>
          ) : null}
          {ownership === 'shared' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 cursor-pointer gap-2"
              onClick={props.onForkWorkspace}
            >
              <GitFork className="size-3.5" data-icon="inline-start" />
              Fork
            </Button>
          ) : null}
          <ChartsAddMenu
            onSelectWidget={props.onSelectWidget}
            onAddWorkspace={props.onAddWorkspace}
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
                  {props.workspace?.title ?? 'Charts'}
                </TruncatedText>
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex shrink-0 cursor-pointer"
                      aria-label="Workspace description"
                    >
                      <Info className="size-4" aria-hidden />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-left">
                    {resolveChartsDescription({
                      description: props.workspace?.description,
                      title: props.workspace?.title,
                    })}
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
              <CardDescription>
                Customize your board by arranging widgets. Changes sync to your
                account.
              </CardDescription>
            </div>
            {props.workspace ? (
              <ChartsWorkspaceActionsMenu
                ownership={ownership}
                status={props.workspace.status}
                isScoped={props.workspaceScoped}
                onRename={props.onRenameWorkspace}
                onMarkNonScoped={props.onMarkNonScoped}
                onArchive={props.onArchiveWorkspace}
                onRestore={props.onRestoreWorkspace}
                onRequestDelete={() =>
                  props.onRequestDelete(
                    ownership === 'shared' ? 'share' : 'owned'
                  )
                }
              />
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto pt-2 pb-2">
          <ChartsBoardCanvas
            instances={props.instances}
            layout={props.layout}
            hydrated={props.hydrated}
            focusWidgetId={props.focusWidgetId}
            accessibleProjects={props.shareProjects}
            accessibleSprints={props.accessibleSprints}
            assigneeMembers={props.assigneeMembers}
            onLayoutChange={props.onLayoutChange}
            onRemoveWidget={props.onRemoveWidget}
            onDuplicateWidget={props.onDuplicateWidget}
            onRenameWidget={props.onRenameWidget}
            onFiltersChange={props.onFiltersChange}
            workspaceScoped={props.workspaceScoped}
            onViewModeChange={props.onViewModeChange}
            onPieVariantChange={props.onPieVariantChange}
            onLabelFieldChange={props.onLabelFieldChange}
            onDisplaySettingsChange={props.onDisplaySettingsChange}
            onFocusWidgetDismiss={props.onFocusWidgetDismiss}
          />
        </CardContent>
      </Card>

      <ChartsWidgetScopeDialog
        open={props.pendingBurndownTypeId != null}
        onOpenChange={props.onPendingBurndownOpenChange}
        mode="create"
        typeId={props.pendingBurndownTypeId ?? 'burndown'}
        projects={props.shareProjects}
        sprints={props.accessibleSprints}
        insertPreference={{
          projectId: props.activeBoardFilter.projectId,
          sprintId: props.activeBoardFilter.sprintId,
        }}
        onConfirm={props.onConfirmBurndownScope}
      />

      <ChartsSaveWorkspaceDialog
        open={props.createDialogOpen}
        onOpenChange={props.onCreateDialogOpenChange}
        mode="create"
        defaultTitle={props.createDefaultTitle}
        aliceContext={{ widgetCount: props.instances.length }}
        projects={props.shareProjects}
        sprints={props.accessibleSprints}
        onSave={props.onCreateWorkspace}
      />
      <ChartsSaveWorkspaceDialog
        open={props.saveDialogOpen}
        onOpenChange={props.onSaveDialogOpenChange}
        mode="save"
        defaultTitle={props.saveDefaultTitle}
        defaultDescription={props.workspace?.description ?? null}
        aliceContext={{
          widgets: props.instances.map((item) => ({
            typeId: item.typeId,
            title: item.title ?? null,
            labelField: item.labelField ?? null,
            pieVariant: item.pieVariant ?? null,
          })),
        }}
        onSave={props.onSaveWorkspace}
      />
      {props.deleteKind ? (
        <ChartsWorkspaceDeleteDialog
          deleteKind={props.deleteKind}
          title={props.workspace?.title ?? 'this workspace'}
          deletePending={props.deletePending}
          onCancel={props.onCancelDelete}
          onConfirm={props.onConfirmDelete}
        />
      ) : null}
    </div>
  );
}
