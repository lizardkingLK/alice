'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { WorkItemStatus } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { DropdownMenuItem } from '@repo/ui/components/ui/dropdown-menu';
import { Filter, LogOut, MoreHorizontal, Settings } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { SearchInput } from '@/components/search-input';
import { preventDismissForFloatingPortal } from '@/lib/dialog-outside-events';
import type {
  ChartPieVariant,
  ChartsLabelFieldId,
  ChartsTableColumnId,
  ChartWidgetViewMode,
  ChartsWidgetFiltersChangeHandler,
  ChartsWidgetLabelFieldChangeHandler,
  ChartsWidgetPieVariantChangeHandler,
  ChartsWidgetViewModeChangeHandler,
} from '@/app/charts/_components/charts.types';
import { ChartsAdvancedFiltersPopover } from '@/app/charts/_components/charts-advanced-filters-popover';
import { ChartsFullscreenDialogShell } from '@/app/charts/_components/charts-fullscreen-dialog-shell';
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
import {
  filterChartDrilldownTableItems,
  isChartSeriesLabelField,
  resolveChartAnalyticsDimensionFilters,
  resolveChartAnalyticsProjectId,
  resolveChartAnalyticsSprintId,
  workItemListRowToChartTableItem,
} from '@/app/charts/_helpers/charts-analytics.ui';
import { useChartWidgetAnalytics } from '@/app/charts/_hooks/use-chart-widget-analytics';

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
  readonly viewMode?: ChartWidgetViewMode;
  readonly pieVariant?: ChartPieVariant;
  readonly labelField?: ChartsLabelFieldId;
  readonly showValueAs?: 'value' | 'percent';
  readonly sortSlicesBy?:
    'value_desc' | 'value_asc' | 'label_asc' | 'label_desc';
  readonly showEmptySlices?: boolean;
  readonly visibleTableColumns?: readonly ChartsTableColumnId[];
  readonly focusedSliceKey?: string;
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
    patch: {
      readonly showValueAs?: 'value' | 'percent';
      readonly sortSlicesBy?:
        'value_desc' | 'value_asc' | 'label_asc' | 'label_desc';
      readonly showEmptySlices?: boolean;
      readonly visibleTableColumns?: readonly ChartsTableColumnId[];
    }
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
      setFiltersOpen(false);
      setSettingsOpen(false);
      return;
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

export function ChartsWidgetConfigDialog({
  open,
  onOpenChange,
  title,
  initialFiltersOpen = false,
  initialSettingsOpen = false,
  filters = null,
  viewMode = 'chart',
  pieVariant = 'donut',
  labelField = DEFAULT_CHARTS_LABEL_FIELD,
  showValueAs = 'percent',
  sortSlicesBy = 'value_desc',
  showEmptySlices = false,
  visibleTableColumns,
  focusedSliceKey,
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
  const [filtersOpen, setFiltersOpen] = useState(initialFiltersOpen);
  const [settingsOpen, setSettingsOpen] = useState(initialSettingsOpen);
  const [searchQuery, setSearchQuery] = useState('');

  const projectId = resolveChartAnalyticsProjectId(filters);
  const sprintId = resolveChartAnalyticsSprintId(filters);
  const dimensionFilters = useMemo(
    () => resolveChartAnalyticsDimensionFilters(filters),
    [filters]
  );
  const seriesLabelField = isChartSeriesLabelField(labelField)
    ? labelField
    : null;
  const needsTable = viewMode === 'table' || viewMode === 'split';
  const hasSliceFocus =
    focusedSliceKey !== undefined && focusedSliceKey !== null;
  /** No slice selected → all status groups; slice selected → that scope only. */
  const showAllStatusGroups = !hasSliceFocus;
  const loadDrilldown = open && needsTable;

  const analytics = useChartWidgetAnalytics({
    projectId,
    labelField: seriesLabelField,
    ...(sprintId ? { sprintId } : {}),
    dimensionFilters,
    focusedSliceKey: hasSliceFocus ? focusedSliceKey : null,
    loadDrilldown,
    drilldownLimit: showAllStatusGroups ? 100 : 50,
  });

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
   * is visible. Mark the open session handled either way so a later user choice
   * of Chart is not immediately forced back to Split.
   */
  const promotedSplitOnOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      promotedSplitOnOpenRef.current = false;
      return;
    }
    if (promotedSplitOnOpenRef.current) {
      return;
    }
    promotedSplitOnOpenRef.current = true;
    if (viewMode === 'chart') {
      onViewModeChange?.('split', focusedSliceKey ?? null);
    }
  }, [focusedSliceKey, onViewModeChange, open, viewMode]);

  const handleSliceToggle = (sliceKey: string) => {
    const nextMode: ChartWidgetViewMode =
      viewMode === 'chart' ? 'split' : viewMode;
    if (focusedSliceKey === sliceKey) {
      onViewModeChange?.(nextMode, null);
      return;
    }
    onViewModeChange?.('split', sliceKey);
  };

  const tableItems = useMemo(() => {
    const rows = (analytics.drilldown?.workItems ?? []).map(
      workItemListRowToChartTableItem
    );
    return filterChartDrilldownTableItems(rows, {
      search: searchQuery,
    });
  }, [analytics.drilldown?.workItems, searchQuery]);

  const tableFocusedStatus =
    hasSliceFocus && labelField === 'status' && focusedSliceKey
      ? (focusedSliceKey as WorkItemStatus)
      : null;

  const piePreview = (
    <ChartsStatusPiePreview
      size="dialog"
      slices={analytics.series?.slices ?? null}
      labelField={seriesLabelField ?? 'status'}
      loading={Boolean(open && seriesLabelField && analytics.seriesLoading)}
      emptyMessage={pieEmptyMessage({
        hasSeriesLabel: Boolean(seriesLabelField),
        seriesError: analytics.seriesError,
      })}
      pieVariant={pieVariant}
      selectedSliceKey={hasSliceFocus ? focusedSliceKey : null}
      onSliceClick={handleSliceToggle}
      showValueAs={showValueAs}
      sortSlicesBy={sortSlicesBy}
      showEmptySlices={showEmptySlices}
    />
  );

  const tablePreview = (
    <ChartsStatusGroupedTable
      workItems={tableItems}
      focusedStatus={tableFocusedStatus}
      loading={Boolean(
        open && seriesLabelField && loadDrilldown && analytics.drilldownLoading
      )}
      emptyMessage={open ? (analytics.drilldownError ?? NO_MATCH_MESSAGE) : ''}
      visibleColumns={visibleTableColumns}
    />
  );

  return (
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

        {settingsOpen && onPieVariantChange ? (
          <ChartsWidgetSettingsSidebar
            pieVariant={pieVariant}
            labelField={labelField}
            onPieVariantChange={onPieVariantChange}
            onLabelFieldChange={onLabelFieldChange}
            showValueAs={showValueAs}
            sortSlicesBy={sortSlicesBy}
            showEmptySlices={showEmptySlices}
            visibleTableColumns={visibleTableColumns}
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
          />
        ) : null}
      </div>
    </ChartsFullscreenDialogShell>
  );
}
