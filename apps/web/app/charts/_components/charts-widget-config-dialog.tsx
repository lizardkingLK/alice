'use client';

import { useEffect, useMemo, useState } from 'react';
import type { WorkItemStatus } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { DropdownMenuItem } from '@repo/ui/components/ui/dropdown-menu';
import { Filter, LogOut, MoreHorizontal } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { SearchInput } from '@/components/search-input';
import { preventDismissForFloatingPortal } from '@/lib/dialog-outside-events';
import type { ChartWidgetViewMode } from '@/app/charts/_components/charts.types';
import { ChartsAdvancedFiltersPopover } from '@/app/charts/_components/charts-advanced-filters-popover';
import { ChartsAssigneeAvatarFilter } from '@/app/charts/_components/charts-assignee-avatar-filter';
import { ChartsFullscreenDialogShell } from '@/app/charts/_components/charts-fullscreen-dialog-shell';
import { ChartsStatusGroupedTable } from '@/app/charts/_components/charts-status-grouped-table';
import { ChartsStatusPiePreview } from '@/app/charts/_components/charts-status-pie-preview';
import { ChartsWidgetActionsMenu } from '@/app/charts/_components/charts-widget-actions-menu';
import { ChartsWidgetLayoutMenu } from '@/app/charts/_components/charts-widget-layout-menu';
import {
  CHARTS_SAMPLE_WORK_ITEMS,
  filterChartsSampleWorkItems,
  type ChartsExportFormatId,
  type ChartsSampleWorkItem,
  type ChartsWidgetFilterDraft,
} from '@/app/charts/_components/charts-sample.data';

type ChartsWidgetConfigDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- controlled dialog
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly initialFiltersOpen?: boolean;
  readonly filters?: ChartsWidgetFilterDraft | null;
  readonly viewMode?: ChartWidgetViewMode;
  readonly focusedStatus?: WorkItemStatus;
  readonly sessionWorkItems?: readonly ChartsSampleWorkItem[];
  readonly onSessionWorkItemsChange?: (
    // eslint-disable-next-line no-unused-vars
    next: ChartsSampleWorkItem[]
  ) => void;
  // eslint-disable-next-line no-unused-vars -- persist applied filters
  readonly onFiltersChange?: (filters: ChartsWidgetFilterDraft | null) => void;
  readonly onViewModeChange?: (
    // eslint-disable-next-line no-unused-vars
    viewMode: ChartWidgetViewMode,
    // eslint-disable-next-line no-unused-vars
    focusedStatus?: WorkItemStatus | null
  ) => void;
  readonly onRename?: () => void;
  readonly onDuplicate?: () => void;
  readonly onDelete?: () => void;
  // eslint-disable-next-line no-unused-vars -- export stub
  readonly onExport?: (format: ChartsExportFormatId) => void;
};

export function ChartsWidgetConfigDialog({
  open,
  onOpenChange,
  title,
  initialFiltersOpen = false,
  filters = null,
  viewMode = 'chart',
  focusedStatus,
  sessionWorkItems = CHARTS_SAMPLE_WORK_ITEMS,
  onSessionWorkItemsChange,
  onFiltersChange,
  onViewModeChange,
  onRename,
  onDuplicate,
  onDelete,
  onExport,
}: Readonly<ChartsWidgetConfigDialogProps>) {
  const [filtersOpen, setFiltersOpen] = useState(initialFiltersOpen);
  const [searchQuery, setSearchQuery] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setFiltersOpen(false);
      return;
    }

    setSearchQuery('');
    setAssigneeFilter(null);

    if (!initialFiltersOpen) {
      setFiltersOpen(false);
      return;
    }

    // Wait until the dialog has mounted/focused so the popover can open.
    const timer = window.setTimeout(() => {
      setFiltersOpen(true);
    }, 80);

    return () => window.clearTimeout(timer);
  }, [open, initialFiltersOpen]);

  const filteredWorkItems = useMemo(
    () =>
      filterChartsSampleWorkItems(sessionWorkItems, filters, {
        search: searchQuery,
        assigneeId: assigneeFilter,
      }),
    [assigneeFilter, filters, searchQuery, sessionWorkItems]
  );

  const handleLayoutChange = (mode: ChartWidgetViewMode) => {
    onViewModeChange?.(mode, null);
  };

  const handleSliceClick = (status: WorkItemStatus) => {
    onViewModeChange?.('split', status);
  };

  return (
    <ChartsFullscreenDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={`Configure filters and preview for the ${title} chart widget.`}
      sizeClassName="h-[min(92vh,860px)] w-[min(96vw,1100px)]"
      contentProps={{
        dismissOnOutsideClick: false,
        onPointerDownOutside: preventDismissForFloatingPortal,
        onInteractOutside: preventDismissForFloatingPortal,
        onFocusOutside: (event) => event.preventDefault(),
      }}
    >
      <div className="border-border flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-2.5">
        <SearchInput
          value={searchQuery}
          onValueChange={setSearchQuery}
          onClear={() => setSearchQuery('')}
          placeholder="Type to filter"
          enableFocusShortcut={false}
          className="w-full max-w-xs sm:w-56"
        />

        <ChartsAdvancedFiltersPopover
          open={filtersOpen}
          onOpenChange={setFiltersOpen}
          appliedFilters={filters}
          onApply={(draft) => onFiltersChange?.(draft)}
          searchQuery={searchQuery}
          assigneeId={assigneeFilter}
          trigger={
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Filter"
              aria-expanded={filtersOpen}
              title={undefined}
              className={cn(
                'h-9 cursor-pointer gap-1.5 px-3',
                (filtersOpen || filters) &&
                  'border-primary bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary'
              )}
            >
              <Filter className="size-3.5" />
              Filter
            </Button>
          }
        />

        <ChartsAssigneeAvatarFilter
          selectedId={assigneeFilter}
          onSelectedIdChange={setAssigneeFilter}
        />

        <div className="ml-auto flex items-center gap-1">
          <ChartsWidgetLayoutMenu
            viewMode={viewMode}
            onViewModeChange={handleLayoutChange}
          />

          <ChartsWidgetActionsMenu
            contentClassName="w-52"
            showExport
            onExport={onExport}
            onRename={() => {
              onOpenChange(false);
              onRename?.();
            }}
            onDuplicate={() => onDuplicate?.()}
            onDelete={() => {
              onOpenChange(false);
              onDelete?.();
            }}
            leadingItem={
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onSelect={() => onOpenChange(false)}
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

      <div className="bg-background flex min-h-0 flex-1 flex-col overflow-hidden p-4 sm:p-6">
        {viewMode === 'split' ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            <div className="border-border flex min-h-0 flex-[1.2] flex-col overflow-hidden border-b pb-3">
              <ChartsStatusPiePreview
                size="dialog"
                workItems={filteredWorkItems}
                onSliceClick={handleSliceClick}
              />
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <ChartsStatusGroupedTable
                workItems={filteredWorkItems}
                sourceWorkItems={sessionWorkItems}
                onWorkItemsChange={onSessionWorkItemsChange}
                focusedStatus={focusedStatus}
              />
            </div>
          </div>
        ) : null}
        {viewMode === 'chart' ? (
          <ChartsStatusPiePreview
            size="dialog"
            workItems={filteredWorkItems}
            onSliceClick={handleSliceClick}
          />
        ) : null}
        {viewMode === 'table' ? (
          <ChartsStatusGroupedTable
            workItems={filteredWorkItems}
            sourceWorkItems={sessionWorkItems}
            onWorkItemsChange={onSessionWorkItemsChange}
            focusedStatus={focusedStatus}
          />
        ) : null}
      </div>
    </ChartsFullscreenDialogShell>
  );
}
