'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkItemStatus } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { DropdownMenuItem } from '@repo/ui/components/ui/dropdown-menu';
import { Filter, LogOut, MoreHorizontal, Settings } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { SearchInput } from '@/components/search-input';
import {
  afterDialogClose,
  DIALOG_CLOSE_ANIMATION_MS,
} from '@/lib/dialog-close';
import { preventDismissForFloatingPortal } from '@/lib/dialog-outside-events';
import type {
  ChartPieVariant,
  ChartsLabelFieldId,
  ChartsSliceColorToken,
  ChartsTableColumnId,
  ChartWidgetDisplaySettingsPatch,
  ChartWidgetMeasure,
  ChartWidgetViewMode,
  ChartsWidgetFiltersChangeHandler,
  ChartsWidgetLabelFieldChangeHandler,
  ChartsWidgetPieVariantChangeHandler,
  ChartsWidgetViewModeChangeHandler,
} from '@/app/charts/_components/charts.types';
import { ChartsAdvancedFiltersPopover } from '@/app/charts/_components/charts-advanced-filters-popover';
import { ChartsFullscreenDialogShell } from '@/app/charts/_components/charts-fullscreen-dialog-shell';
import { ChartsNestedDonutPreview } from '@/app/charts/_components/charts-nested-donut-preview';
import { ChartsStatusGroupedTable } from '@/app/charts/_components/charts-status-grouped-table';
import { ChartsStatusPiePreview } from '@/app/charts/_components/charts-status-pie-preview';
import { ChartsWidgetActionsMenu } from '@/app/charts/_components/charts-widget-actions-menu';
import { ChartsWidgetLayoutMenu } from '@/app/charts/_components/charts-widget-layout-menu';
import { ChartsWidgetSettingsSidebar } from '@/app/charts/_components/charts-widget-settings-sidebar';
import {
  DEFAULT_CHARTS_LABEL_FIELD,
  type ChartsExportFormatId,
  type ChartsProjectOption,
  type ChartsSampleMember,
  type ChartsSprintOption,
  type ChartsWidgetFilterDraft,
} from '@/app/charts/_components/charts-sample.data';
import type { ChartSeriesLabelField } from '@repo/types';
import {
  filterChartDrilldownTableItems,
  isChartSeriesLabelField,
  resolveChartAnalyticsDimensionFilters,
  resolveChartAnalyticsProjectId,
  resolveChartAnalyticsSprintId,
  workItemListRowToChartTableItem,
  type ChartDrilldownTableItem,
} from '@/app/charts/_helpers/charts-analytics.ui';
import {
  invalidateChartAnalyticsCaches,
  useChartWidgetAnalytics,
} from '@/app/charts/_hooks/use-chart-widget-analytics';
import { useChartWidgetHierarchyAnalytics } from '@/app/charts/_hooks/use-chart-widget-hierarchy-analytics';
import type { ChartsHierarchyDigStep } from '@/app/charts/_helpers/charts-nested-donut-widget';
import { WorkItemFormDialog } from '@/app/work-items/_components/work-item-form/work-item-form-dialog';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import type { Project as DbProject } from '@/app/projects/_types/projects.types';

const SCOPE_EMPTY_MESSAGE = 'No work items in the selected scope.';
const UNSUPPORTED_LABEL_MESSAGE =
  'This Labels column is not available for live charts yet. Choose Status, Owner, Project, Type, or Priority.';
const NO_MATCH_MESSAGE = 'No work items match the current filters.';

type ChartsWidgetConfigDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- controlled dialog
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly initialFiltersOpen?: boolean;
  /** Open with the widget settings sidebar visible (Settings menu / cog). */
  readonly initialSettingsOpen?: boolean;
  readonly filters?: ChartsWidgetFilterDraft | null;
  readonly scopeLocked?: boolean;
  readonly viewMode?: ChartWidgetViewMode;
  readonly settingsMode?: 'chart' | 'nested-donut';
  readonly pieVariant?: ChartPieVariant;
  readonly labelField?: ChartsLabelFieldId;
  readonly measure?: ChartWidgetMeasure;
  readonly showValueAs?: 'value' | 'percent';
  readonly sortSlicesBy?:
    'value_desc' | 'value_asc' | 'label_asc' | 'label_desc';
  readonly showEmptySlices?: boolean;
  readonly visibleTableColumns?: readonly ChartsTableColumnId[];
  readonly sliceColors?: Readonly<Record<string, ChartsSliceColorToken>>;
  readonly focusedSliceKey?: string;
  readonly digPath?: readonly ChartsHierarchyDigStep[];
  onDigPathChange?: (
    // eslint-disable-next-line no-unused-vars -- dig path
    next: readonly ChartsHierarchyDigStep[]
  ) => void;
  readonly accessibleProjects?: readonly ChartsProjectOption[];
  readonly accessibleSprints?: readonly ChartsSprintOption[];
  /** Accessible project members for Assignee options in the filter popover. */
  readonly assigneeMembers?: readonly ChartsSampleMember[];
  readonly onFiltersChange?: ChartsWidgetFiltersChangeHandler;
  readonly onViewModeChange?: ChartsWidgetViewModeChangeHandler;
  readonly onPieVariantChange?: ChartsWidgetPieVariantChangeHandler;
  readonly onLabelFieldChange?: ChartsWidgetLabelFieldChangeHandler;
  readonly onDisplaySettingsChange?: (
    // eslint-disable-next-line no-unused-vars -- settings patch
    patch: ChartWidgetDisplaySettingsPatch
  ) => void;
  readonly onRename?: () => void;
  readonly onDuplicate?: () => void;
  readonly onDelete?: () => void;
  // eslint-disable-next-line no-unused-vars -- export stub
  readonly onExport?: (format: ChartsExportFormatId) => void;
};

function pieEmptyMessage(params: {
  readonly hasSeriesLabel: boolean;
  readonly seriesError: string | null;
}): string {
  if (!params.hasSeriesLabel) {
    return UNSUPPORTED_LABEL_MESSAGE;
  }
  return params.seriesError ?? SCOPE_EMPTY_MESSAGE;
}

function useConfigDialogBootstrap(params: {
  readonly open: boolean;
  readonly initialFiltersOpen: boolean;
  readonly initialSettingsOpen: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly setFiltersOpen: (open: boolean) => void;
  // eslint-disable-next-line no-unused-vars
  readonly setSettingsOpen: (open: boolean) => void;
  // eslint-disable-next-line no-unused-vars
  readonly setSearchQuery: (value: string) => void;
}) {
  const {
    open,
    initialFiltersOpen,
    initialSettingsOpen,
    setFiltersOpen,
    setSettingsOpen,
    setSearchQuery,
  } = params;

  useEffect(() => {
    if (!open) {
      // Keep sidebar / filter chrome through the dialog exit animation, then
      // clear — same deferred-close pattern as registry menus.
      const timer = window.setTimeout(() => {
        setFiltersOpen(false);
        setSettingsOpen(false);
      }, DIALOG_CLOSE_ANIMATION_MS);
      return () => window.clearTimeout(timer);
    }

    setSearchQuery('');
    setSettingsOpen(initialSettingsOpen);
    if (!initialFiltersOpen) {
      setFiltersOpen(false);
      return;
    }

    const timer = window.setTimeout(() => setFiltersOpen(true), 80);
    return () => window.clearTimeout(timer);
  }, [
    open,
    initialFiltersOpen,
    initialSettingsOpen,
    setFiltersOpen,
    setSearchQuery,
    setSettingsOpen,
  ]);
}

function ChartsWidgetConfigToolbar(props: {
  readonly searchQuery: string;
  // eslint-disable-next-line no-unused-vars
  readonly onSearchQueryChange: (value: string) => void;
  readonly filtersOpen: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onFiltersOpenChange: (open: boolean) => void;
  readonly filters: ChartsWidgetFilterDraft | null;
  readonly scopeLocked?: boolean;
  readonly accessibleProjects: readonly ChartsProjectOption[];
  readonly accessibleSprints: readonly ChartsSprintOption[];
  readonly onFiltersChange?: ChartsWidgetFiltersChangeHandler;
  readonly members: readonly ChartsSampleMember[];
  readonly viewMode: ChartWidgetViewMode;
  // eslint-disable-next-line no-unused-vars
  readonly onLayoutChange: (mode: ChartWidgetViewMode) => void;
  readonly settingsOpen: boolean;
  readonly onToggleSettings: () => void;
  readonly onExport: ChartsWidgetConfigDialogProps['onExport'];
  readonly onRename?: () => void;
  readonly onDuplicate?: () => void;
  readonly onDelete?: () => void;
  readonly onExit: () => void;
}) {
  const filterActive = props.filtersOpen || Boolean(props.filters);

  return (
    <div className="border-border flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2.5">
      <SearchInput
        value={props.searchQuery}
        onValueChange={props.onSearchQueryChange}
        onClear={() => props.onSearchQueryChange('')}
        placeholder="Filter by task or assignee"
        enableFocusShortcut={false}
        className="w-full max-w-xs sm:w-56"
      />

      <ChartsAdvancedFiltersPopover
        open={props.filtersOpen}
        onOpenChange={props.onFiltersOpenChange}
        appliedFilters={props.filters}
        scopeLocked={props.scopeLocked}
        onApply={(draft) => props.onFiltersChange?.(draft)}
        projects={props.accessibleProjects}
        sprints={props.accessibleSprints}
        members={props.members}
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Filter"
            aria-expanded={props.filtersOpen}
            title="Filter"
            className={cn(
              'text-muted-foreground hover:text-foreground shrink-0 cursor-pointer',
              filterActive &&
                'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
            )}
          >
            <Filter className="size-4" />
          </Button>
        }
      />

      <div className="ml-auto flex items-center gap-1">
        <ChartsWidgetLayoutMenu
          viewMode={props.viewMode}
          onViewModeChange={props.onLayoutChange}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Widget settings"
          aria-pressed={props.settingsOpen}
          title="Widget settings"
          onClick={props.onToggleSettings}
          className={cn(
            'text-muted-foreground hover:text-foreground shrink-0 cursor-pointer',
            props.settingsOpen &&
              'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
          )}
        >
          <Settings className="size-4" />
        </Button>

        <ChartsWidgetActionsMenu
          contentClassName="w-52"
          showExport
          onExport={props.onExport}
          onSettings={props.onToggleSettings}
          onRename={() => {
            props.onExit();
            props.onRename?.();
          }}
          onDuplicate={() => props.onDuplicate?.()}
          onDelete={() => {
            props.onExit();
            props.onDelete?.();
          }}
          leadingItem={
            <DropdownMenuItem
              className="cursor-pointer gap-2"
              onSelect={props.onExit}
            >
              <LogOut className="size-4" />
              Exit full screen
            </DropdownMenuItem>
          }
          trigger={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="More options"
              className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
      </div>
    </div>
  );
}

function ChartsWidgetConfigPreview(props: {
  readonly viewMode: ChartWidgetViewMode;
  readonly piePreview: ReactNode;
  readonly tablePreview: ReactNode;
}) {
  if (props.viewMode === 'split') {
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="border-border flex min-h-0 flex-[1.2] flex-col overflow-hidden border-b pb-3">
          {props.piePreview}
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {props.tablePreview}
        </div>
      </div>
    );
  }
  if (props.viewMode === 'table') {
    return props.tablePreview;
  }
  return props.piePreview;
}

function resolveTableFocusedStatus(params: {
  readonly isNested: boolean;
  readonly hasSliceFocus: boolean;
  readonly labelField: ChartsLabelFieldId;
  readonly focusedSliceKey: string | undefined;
}): WorkItemStatus | null {
  if (
    params.isNested ||
    !params.hasSliceFocus ||
    params.labelField !== 'status' ||
    !params.focusedSliceKey
  ) {
    return null;
  }
  return params.focusedSliceKey as WorkItemStatus;
}

function resolveSettingsSliceOptions(params: {
  readonly isNested: boolean;
  readonly nestedRings:
    | readonly {
        readonly slices: readonly {
          readonly key: string;
          readonly label: string;
        }[];
      }[]
    | null
    | undefined;
  readonly flatSlices:
    | readonly { readonly key: string; readonly label: string }[]
    | null
    | undefined;
}): readonly { readonly key: string; readonly label: string }[] {
  if (params.isNested) {
    return (
      params.nestedRings?.flatMap((ring) =>
        ring.slices.map((slice) => ({
          key: slice.key,
          label: slice.label,
        }))
      ) ?? []
    );
  }
  return (
    params.flatSlices?.map((slice) => ({
      key: slice.key,
      label: slice.label,
    })) ?? []
  );
}

function renderConfigPiePreview(params: {
  readonly isNested: boolean;
  readonly open: boolean;
  readonly hierarchy: ReturnType<typeof useChartWidgetHierarchyAnalytics>;
  readonly analytics: ReturnType<typeof useChartWidgetAnalytics>;
  readonly seriesLabelField: ChartSeriesLabelField | null;
  readonly hasSliceFocus: boolean;
  readonly focusedSliceKey: string | undefined;
  readonly digPath: readonly ChartsHierarchyDigStep[];
  // eslint-disable-next-line no-unused-vars -- dig path
  readonly onDigPathChange: (next: readonly ChartsHierarchyDigStep[]) => void;
  readonly preferNestedDrilldown: boolean;
  // eslint-disable-next-line no-unused-vars -- slice key
  readonly onSliceToggle: (sliceKey: string) => void;
  readonly showValueAs: 'value' | 'percent';
  readonly sliceColors: Readonly<Record<string, ChartsSliceColorToken>> | undefined;
  readonly pieVariant: ChartPieVariant;
  readonly sortSlicesBy:
    | 'value_desc'
    | 'value_asc'
    | 'label_asc'
    | 'label_desc';
  readonly showEmptySlices: boolean;
}): ReactNode {
  if (params.isNested) {
    return (
      <ChartsNestedDonutPreview
        size="dialog"
        rings={params.hierarchy.series?.rings ?? null}
        loading={Boolean(params.open && params.hierarchy.seriesLoading)}
        emptyMessage={params.hierarchy.seriesError ?? SCOPE_EMPTY_MESSAGE}
        selectedFocusKey={
          params.hasSliceFocus ? params.focusedSliceKey : null
        }
        digPath={params.digPath}
        onDigPathChange={params.onDigPathChange}
        preferDrilldown={params.preferNestedDrilldown}
        onDrilldownFocus={params.onSliceToggle}
        showValueAs={params.showValueAs}
        sliceColors={params.sliceColors}
      />
    );
  }
  return (
    <ChartsStatusPiePreview
      size="dialog"
      slices={params.analytics.series?.slices ?? null}
      labelField={params.seriesLabelField ?? 'category'}
      loading={Boolean(
        params.open &&
          params.seriesLabelField &&
          params.analytics.seriesLoading
      )}
      emptyMessage={pieEmptyMessage({
        hasSeriesLabel: Boolean(params.seriesLabelField),
        seriesError: params.analytics.seriesError,
      })}
      pieVariant={params.pieVariant}
      selectedSliceKey={params.hasSliceFocus ? params.focusedSliceKey : null}
      onSliceClick={params.onSliceToggle}
      showValueAs={params.showValueAs}
      sortSlicesBy={params.sortSlicesBy}
      showEmptySlices={params.showEmptySlices}
      sliceColors={params.sliceColors}
    />
  );
}

function usePromoteChartSplitOnOpen(params: {
  readonly open: boolean;
  readonly isNested: boolean;
  readonly viewMode: ChartWidgetViewMode;
  readonly focusedSliceKey: string | undefined;
  readonly onViewModeChange?: ChartsWidgetViewModeChangeHandler;
}): void {
  const { open, isNested, viewMode, focusedSliceKey, onViewModeChange } =
    params;
  const promotedSplitOnOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      promotedSplitOnOpenRef.current = false;
      return;
    }
    if (promotedSplitOnOpenRef.current || isNested) {
      return;
    }
    promotedSplitOnOpenRef.current = true;
    if (viewMode === 'chart') {
      onViewModeChange?.('split', focusedSliceKey ?? null);
    }
  }, [focusedSliceKey, isNested, onViewModeChange, open, viewMode]);
}

function useChartsWidgetConfigSeries(params: {
  readonly open: boolean;
  readonly isNested: boolean;
  readonly filters: ChartsWidgetFilterDraft | null;
  readonly labelField: ChartsLabelFieldId;
  readonly measure: ChartWidgetMeasure;
  readonly viewMode: ChartWidgetViewMode;
  readonly focusedSliceKey: string | undefined;
  readonly digPath: readonly ChartsHierarchyDigStep[];
}) {
  const projectId = resolveChartAnalyticsProjectId(params.filters);
  const sprintId = resolveChartAnalyticsSprintId(params.filters);
  const dimensionFilters = useMemo(
    () => resolveChartAnalyticsDimensionFilters(params.filters),
    [params.filters]
  );
  const seriesLabelField = isChartSeriesLabelField(params.labelField)
    ? params.labelField
    : null;
  const needsTable =
    params.viewMode === 'table' || params.viewMode === 'split';
  const hasSliceFocus =
    params.focusedSliceKey !== undefined && params.focusedSliceKey !== null;
  const showAllStatusGroups = !hasSliceFocus;
  const loadDrilldown = params.open && needsTable;
  const digRootId = params.digPath.at(-1)?.id;
  const drilldownLimit = showAllStatusGroups ? 100 : 50;
  const focusedKey = hasSliceFocus ? params.focusedSliceKey : null;

  const analytics = useChartWidgetAnalytics({
    projectId: params.isNested ? undefined : projectId,
    labelField: params.isNested ? null : seriesLabelField,
    ...(sprintId ? { sprintId } : {}),
    dimensionFilters,
    focusedSliceKey: focusedKey,
    loadDrilldown: params.isNested ? false : loadDrilldown,
    drilldownLimit,
  });
  const hierarchy = useChartWidgetHierarchyAnalytics({
    projectId: params.isNested ? projectId : undefined,
    measure: params.measure,
    ...(digRootId ? { rootWorkItemId: digRootId } : {}),
    ...(sprintId ? { sprintId } : {}),
    dimensionFilters,
    focusedSliceKey: focusedKey,
    loadDrilldown: params.isNested ? loadDrilldown : false,
    drilldownLimit,
  });

  return {
    projectId,
    seriesLabelField,
    hasSliceFocus,
    loadDrilldown,
    preferNestedDrilldown: needsTable,
    analytics,
    hierarchy,
  };
}

export function ChartsWidgetConfigDialog({
  open,
  onOpenChange,
  title,
  settingsMode = 'chart',
  initialFiltersOpen = false,
  initialSettingsOpen = false,
  filters = null,
  scopeLocked = false,
  viewMode = 'chart',
  pieVariant = 'donut',
  labelField = DEFAULT_CHARTS_LABEL_FIELD,
  measure = 'item_count',
  showValueAs = 'percent',
  sortSlicesBy = 'value_desc',
  showEmptySlices = false,
  visibleTableColumns,
  sliceColors,
  focusedSliceKey,
  digPath = [],
  onDigPathChange,
  accessibleProjects = [],
  accessibleSprints = [],
  assigneeMembers = [],
  onFiltersChange,
  onViewModeChange,
  onPieVariantChange,
  onLabelFieldChange,
  onDisplaySettingsChange,
  onRename,
  onDuplicate,
  onDelete,
  onExport,
}: Readonly<ChartsWidgetConfigDialogProps>) {
  const router = useRouter();
  const [filtersOpen, setFiltersOpen] = useState(initialFiltersOpen);
  const [settingsOpen, setSettingsOpen] = useState(initialSettingsOpen);
  const [searchQuery, setSearchQuery] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<DbWorkItem | null>(null);
  const isNested = settingsMode === 'nested-donut';

  const {
    projectId,
    seriesLabelField,
    hasSliceFocus,
    loadDrilldown,
    preferNestedDrilldown,
    analytics,
    hierarchy,
  } = useChartsWidgetConfigSeries({
    open,
    isNested,
    filters,
    labelField,
    measure,
    viewMode,
    focusedSliceKey,
    digPath,
  });

  const formProjects = useMemo(
    () =>
      accessibleProjects.map(
        (project) =>
          ({
            id: project.id,
            name: project.name,
          }) as DbProject
      ),
    [accessibleProjects]
  );

  const formMembers = useMemo(
    () =>
      assigneeMembers.map((member) => ({
        id: member.id,
        name: member.name,
        email: member.email,
      })),
    [assigneeMembers]
  );

  useConfigDialogBootstrap({
    open,
    initialFiltersOpen,
    initialSettingsOpen,
    setFiltersOpen,
    setSettingsOpen,
    setSearchQuery,
  });

  /**
   * On first open in chart-only layout, promote to split so the drilldown table
   * is visible (status pie). Nested donut stays on Chart so dig-zoom remains
   * available; users can switch to Split/Table for leaf drilldown.
   */
  usePromoteChartSplitOnOpen({
    open,
    isNested,
    viewMode,
    focusedSliceKey,
    onViewModeChange,
  });

  const handleSliceToggle = (sliceKey: string) => {
    const nextMode: ChartWidgetViewMode =
      viewMode === 'chart' ? 'split' : viewMode;
    if (focusedSliceKey === sliceKey) {
      onViewModeChange?.(nextMode, null);
      return;
    }
    onViewModeChange?.('split', sliceKey);
  };

  const handleDigPathChange = (
    next: readonly ChartsHierarchyDigStep[]
  ) => {
    if (focusedSliceKey) {
      onViewModeChange?.(viewMode, null);
    }
    onDigPathChange?.(next);
  };

  const openEditWorkItem = (item: ChartDrilldownTableItem) => {
    if (!item.workItem) {
      return;
    }
    setItemToEdit(item.workItem as unknown as DbWorkItem);
    setEditDialogOpen(true);
  };

  const handleEditDialogChange = (nextOpen: boolean) => {
    setEditDialogOpen(nextOpen);
    if (!nextOpen) {
      afterDialogClose(() => {
        setItemToEdit(null);
      });
    }
  };

  const handleEditSuccess = () => {
    setEditDialogOpen(false);
    afterDialogClose(() => {
      setItemToEdit(null);
    });
    invalidateChartAnalyticsCaches();
    router.refresh();
  };

  const drilldownLoading = isNested
    ? hierarchy.drilldownLoading
    : analytics.drilldownLoading;
  const drilldownError = isNested
    ? hierarchy.drilldownError
    : analytics.drilldownError;

  const nestedWorkItems = hierarchy.drilldown?.workItems;
  const flatWorkItems = analytics.drilldown?.workItems;
  const tableItems = useMemo(() => {
    const sourceRows = isNested
      ? (nestedWorkItems ?? [])
      : (flatWorkItems ?? []);
    const rows = sourceRows.map(workItemListRowToChartTableItem);
    return filterChartDrilldownTableItems(rows, {
      search: searchQuery,
    });
  }, [flatWorkItems, isNested, nestedWorkItems, searchQuery]);

  const tableFocusedStatus = resolveTableFocusedStatus({
    isNested,
    hasSliceFocus,
    labelField,
    focusedSliceKey,
  });

  const piePreview = renderConfigPiePreview({
    isNested,
    open,
    hierarchy,
    analytics,
    seriesLabelField,
    hasSliceFocus,
    focusedSliceKey,
    digPath,
    onDigPathChange: handleDigPathChange,
    preferNestedDrilldown,
    onSliceToggle: handleSliceToggle,
    showValueAs,
    sliceColors,
    pieVariant,
    sortSlicesBy,
    showEmptySlices,
  });

  const tablePreview = (
    <ChartsStatusGroupedTable
      workItems={tableItems}
      focusedStatus={tableFocusedStatus}
      loading={Boolean(
        open &&
          loadDrilldown &&
          drilldownLoading &&
          (isNested || seriesLabelField)
      )}
      emptyMessage={open ? (drilldownError ?? NO_MATCH_MESSAGE) : ''}
      visibleColumns={visibleTableColumns}
      projects={accessibleProjects}
      onEditWorkItem={openEditWorkItem}
    />
  );

  return (
    <>
      <ChartsFullscreenDialogShell
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={`Configure filters and preview for the ${title} chart widget.`}
        sizeClassName="h-[min(92vh,860px)] w-[min(96vw,1280px)]"
        contentProps={{
          dismissOnOutsideClick: false,
          onPointerDownOutside: preventDismissForFloatingPortal,
          onInteractOutside: preventDismissForFloatingPortal,
          onFocusOutside: (event) => event.preventDefault(),
        }}
      >
        <ChartsWidgetConfigToolbar
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          filtersOpen={filtersOpen}
          onFiltersOpenChange={setFiltersOpen}
          filters={filters}
          scopeLocked={scopeLocked}
          accessibleProjects={accessibleProjects}
          accessibleSprints={accessibleSprints}
          onFiltersChange={onFiltersChange}
          members={assigneeMembers}
          viewMode={viewMode}
          onLayoutChange={(mode) => {
            if (mode === 'chart') {
              onViewModeChange?.(mode, null);
              return;
            }
            onViewModeChange?.(mode, focusedSliceKey ?? null);
          }}
          settingsOpen={settingsOpen}
          onToggleSettings={() => setSettingsOpen((prev) => !prev)}
          onExport={onExport}
          onRename={onRename}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
          onExit={() => onOpenChange(false)}
        />

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="bg-background flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
            <ChartsWidgetConfigPreview
              viewMode={viewMode}
              piePreview={piePreview}
              tablePreview={tablePreview}
            />
          </div>

          {settingsOpen && (onPieVariantChange || isNested) ? (
            <ChartsWidgetSettingsSidebar
              projectId={projectId}
              settingsMode={settingsMode}
              pieVariant={pieVariant}
              labelField={labelField}
              measure={measure}
              onPieVariantChange={onPieVariantChange ?? (() => {})}
              onLabelFieldChange={onLabelFieldChange}
              onMeasureChange={(next) =>
                onDisplaySettingsChange?.({ measure: next })
              }
              showValueAs={showValueAs}
              sortSlicesBy={sortSlicesBy}
              showEmptySlices={showEmptySlices}
              visibleTableColumns={visibleTableColumns}
              sliceColors={sliceColors}
              sliceOptions={resolveSettingsSliceOptions({
                isNested,
                nestedRings: hierarchy.series?.rings,
                flatSlices: analytics.series?.slices,
              })}
              onShowValueAsChange={(value) =>
                onDisplaySettingsChange?.({ showValueAs: value })
              }
              onSortSlicesByChange={(value) =>
                onDisplaySettingsChange?.({ sortSlicesBy: value })
              }
              onShowEmptySlicesChange={(value) =>
                onDisplaySettingsChange?.({ showEmptySlices: value })
              }
              onVisibleTableColumnsChange={(columns) =>
                onDisplaySettingsChange?.({ visibleTableColumns: columns })
              }
              onSliceColorsChange={(next) =>
                onDisplaySettingsChange?.({ sliceColors: next })
              }
            />
          ) : null}
        </div>
      </ChartsFullscreenDialogShell>

      <WorkItemFormDialog
        open={editDialogOpen}
        onOpenChange={handleEditDialogChange}
        title="Edit Work Item"
        description="Update the details for this work item."
        projects={formProjects}
        itemToEdit={itemToEdit}
        projectMembers={formMembers}
        preferProvidedMembers
        onClose={() => handleEditDialogChange(false)}
        onSuccess={() => handleEditSuccess()}
      />
    </>
  );
}
