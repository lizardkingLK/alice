'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { BarChart3, X } from '@repo/ui/lib/icons';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { SearchInput } from '@/components/search-input';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
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
  removeChartWidget,
  renameChartWidget,
  updateChartWidgetFilters,
  updateChartWidgetLabelField,
  updateChartWidgetPieVariant,
  updateChartWidgetViewMode,
  updateChartWidgetDisplaySettings,
} from '@/app/charts/_components/charts-board-canvas';
import {
  ChartsFilterDialog,
  type ChartsFilterDraft,
} from '@/app/charts/_components/charts-filter-dialog';
import { ChartsSaveWorkspaceDialog } from '@/app/charts/_components/charts-save-workspace-dialog';
import { ChartsShareWorkspaceDialog } from '@/app/charts/_components/charts-share-workspace-dialog';
import { ChartsWorkspaceActionsMenu } from '@/app/charts/_components/charts-workspace-actions-menu';
import { isChartWidgetAvailable } from '@/app/charts/_components/charts-widget-catalog';
import type {
  ChartBoardOwnershipFilter,
  ChartBoardStatusFilter,
  ChartBoardWidgetInstance,
  ChartPieVariant,
  ChartsLabelFieldId,
  ChartWidgetTypeId,
  ChartWidgetViewMode,
  ChartWorkspaceRecord,
} from '@/app/charts/_components/charts.types';
import type {
  ChartsSampleMember,
  ChartsWidgetFilterDraft,
} from '@/app/charts/_components/charts-sample.data';
import {
  createChartWorkspace,
  ensureDefaultChartWorkspace,
  getChartWorkspace,
  listChartWorkspaces,
  renameChartWorkspaceMeta,
  saveChartWorkspaceBoard,
  setLastOpenedChartWorkspace,
  suggestChartWorkspaceTitle,
} from '@/app/charts/_helpers/charts-workspace-storage';
import { hydrateChartWorkspacesFromApi } from '@/app/charts/_helpers/charts-workspace-hydrate';
import { chartsWorkspaceHref } from '@/app/charts/_helpers/charts-links';
import { createChartWidgetFiltersFromDefaults } from '@/app/charts/_helpers/charts-widget-defaults';
import { useChartsWorkspaceDefaults } from '@/app/charts/_hooks/use-charts-workspace-defaults';
import { syncChartWorkspaceToApi } from '@/app/charts/_services/charts.mutations.client';
import { useDashboardEntityBreadcrumb } from '@/app/dashboard/_components/dashboard-breadcrumb-runtime';

type ChartsWorkspaceProps = {
  readonly workspaceId: string;
  readonly currentUserId: string;
  readonly focusWidgetId?: string;
  readonly search: string;
  readonly ownership: ChartBoardOwnershipFilter;
  readonly status: ChartBoardStatusFilter;
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
  search,
  ownership,
  status,
  shareProjects,
  assigneeMembers,
  projects,
  sprints,
  suggestedDefaults,
}: Readonly<ChartsWorkspaceProps>) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { searchQuery, setSearchQuery } = useDebouncedSearch(search);

  const [workspace, setWorkspace] = useState<ChartWorkspaceRecord | null>(null);
  const [workspaceList, setWorkspaceList] = useState<ChartWorkspaceRecord[]>(
    []
  );
  const [instances, setInstances] = useState<ChartBoardWidgetInstance[]>([]);
  const [layout, setLayout] = useState<LayoutItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const chartsDefaults = useChartsWorkspaceDefaults({
    userId: currentUserId,
    projects,
    sprints,
    suggestedDefaults,
  });

  const refreshList = useCallback(() => {
    setWorkspaceList(
      listChartWorkspaces(currentUserId, {
        ownership,
        status,
        search: searchQuery,
      })
    );
  }, [currentUserId, ownership, searchQuery, status]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      await hydrateChartWorkspacesFromApi(currentUserId);
      if (cancelled) {
        return;
      }

      const record = getChartWorkspace(currentUserId, workspaceId);
      if (!record) {
        const fallback = ensureDefaultChartWorkspace(currentUserId);
        void syncChartWorkspaceToApi(fallback);
        router.replace(`/charts/${fallback.id}`);
        return;
      }
      setLastOpenedChartWorkspace(currentUserId, record.id);
      setWorkspace(record);
      setInstances(record.instances);
      setLayout(record.layout);
      setHydrated(true);
      refreshList();
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [currentUserId, refreshList, router, workspaceId]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const hasActiveFilters = ownership !== 'all' || status !== 'all';

  const replaceQuery = useCallback(
    // eslint-disable-next-line no-unused-vars
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const query = params.toString();
      const base = `/charts/${workspaceId}`;
      router.push(query ? `${base}?${query}` : base);
    },
    [router, searchParams, workspaceId]
  );

  const handleApplyFilters = useCallback(
    (draft: ChartsFilterDraft) => {
      replaceQuery((params) => {
        if (draft.ownership === 'all') {
          params.delete('ownership');
        } else {
          params.set('ownership', draft.ownership);
        }
        if (draft.status === 'all') {
          params.delete('status');
        } else {
          params.set('status', draft.status);
        }
      });
    },
    [replaceQuery]
  );

  const handleClearFilters = useCallback(() => {
    replaceQuery((params) => {
      params.delete('ownership');
      params.delete('status');
    });
  }, [replaceQuery]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
  }, [setSearchQuery]);

  const persistBoard = useCallback(
    (nextInstances: ChartBoardWidgetInstance[], nextLayout: LayoutItem[]) => {
      const updated = saveChartWorkspaceBoard(currentUserId, workspaceId, {
        instances: nextInstances,
        layout: nextLayout,
      });
      if (updated) {
        setWorkspace(updated);
        void syncChartWorkspaceToApi(updated);
      }
      refreshList();
    },
    [currentUserId, refreshList, workspaceId]
  );

  const commitBoard = useCallback(
    (next: { instances: ChartBoardWidgetInstance[]; layout: LayoutItem[] }) => {
      setInstances(next.instances);
      setLayout(next.layout);
      if (hydrated) {
        persistBoard(next.instances, next.layout);
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
    (payload: { title: string; isOverview: boolean }) => {
      const created = createChartWorkspace(currentUserId, {
        title: payload.title,
        isOverview: payload.isOverview,
      });
      void syncChartWorkspaceToApi(created);
      router.push(`/charts/${created.id}`);
    },
    [currentUserId, router]
  );

  const handleSelectWorkspace = useCallback(
    (id: string) => {
      setLastOpenedChartWorkspace(currentUserId, id);
      router.push(`/charts/${id}`);
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
        void syncChartWorkspaceToApi(updated);
      }
      refreshList();
    },
    [currentUserId, refreshList, workspaceId]
  );

  const handleLayoutChange = useCallback(
    (nextLayout: LayoutItem[]) => {
      setLayout(nextLayout);
      if (hydrated) {
        persistBoard(instances, nextLayout);
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
    (
      instanceId: string,
      patch: {
        readonly showValueAs?: 'value' | 'percent';
        readonly sortSlicesBy?:
          'value_desc' | 'value_asc' | 'label_asc' | 'label_desc';
        readonly showEmptySlices?: boolean;
        readonly visibleTableColumns?: ChartBoardWidgetInstance['visibleTableColumns'];
      }
    ) => {
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
      <div className="flex shrink-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <SearchInput
            value={searchQuery}
            onValueChange={setSearchQuery}
            onClear={handleClearSearch}
            placeholder="Search workspaces…"
          />
          <ChartsFilterDialog
            ownership={ownership}
            status={status}
            hasActiveFilters={hasActiveFilters}
            workspaces={workspaceList}
            currentWorkspaceId={workspaceId}
            saveDefaultTitle={saveDefaultTitle}
            currentIsOverview={workspace?.isOverview ?? false}
            onApplyFilters={handleApplyFilters}
            onSelectWorkspace={handleSelectWorkspace}
            onSaveWorkspace={handleSaveWorkspace}
          />
          <WorkspaceDefaultsControls
            onOpenDefaultsDialog={chartsDefaults.openDefaultsDialog}
            savedDefaultsApplied={chartsDefaults.savedDefaultsApplied}
          />
          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-muted-foreground hover:text-foreground h-9 cursor-pointer px-3 text-xs"
            >
              Clear filters
              <X className="size-3.5" />
            </Button>
          ) : null}
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
                Drag and resize widgets. Workspaces are saved on this device;
                cloud sync comes next.
              </CardDescription>
            </div>
            <ChartsWorkspaceActionsMenu
              onShare={() => setShareDialogOpen(true)}
              onRename={() => setSaveDialogOpen(true)}
            />
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
