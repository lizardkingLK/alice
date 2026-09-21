'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Card, CardContent, CardHeader } from '@repo/ui/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { DropdownMenuItem } from '@repo/ui/components/ui/dropdown-menu';
import { Input } from '@repo/ui/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  Filter,
  GripVertical,
  Maximize2,
  MoreHorizontal,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { ChartSeriesLabelField } from '@repo/types';
import { DIALOG_CLOSE_ANIMATION_MS } from '@/lib/dialog-close';
import type { ChartWidgetDefinition } from '@/app/charts/_components/charts-widget-catalog';
import type {
  ChartPieVariant,
  ChartsLabelFieldId,
  ChartsSliceColorToken,
  ChartsTableColumnId,
  ChartWidgetDisplaySettingsPatch,
  ChartWidgetTypeId,
  ChartWidgetViewMode,
  ChartsWidgetFiltersChangeHandler,
  ChartsWidgetLabelFieldChangeHandler,
  ChartsWidgetPieVariantChangeHandler,
  ChartsWidgetViewModeChangeHandler,
} from '@/app/charts/_components/charts.types';
import {
  DEFAULT_CHARTS_LABEL_FIELD,
  type ChartsProjectOption,
  type ChartsSprintOption,
  type ChartsSampleMember,
  type ChartsWidgetFilterDraft,
} from '@/app/charts/_components/charts-sample.data';
import { ChartsFullscreenDialogShell } from '@/app/charts/_components/charts-fullscreen-dialog-shell';
import { ChartsStatusPiePreview } from '@/app/charts/_components/charts-status-pie-preview';
import { ChartsWidgetActionsMenu } from '@/app/charts/_components/charts-widget-actions-menu';
import { ChartsWidgetConfigDialog } from '@/app/charts/_components/charts-widget-config-dialog';
import {
  isChartSeriesLabelField,
  resolveChartAnalyticsDimensionFilters,
  resolveChartAnalyticsProjectId,
  resolveChartAnalyticsSprintId,
} from '@/app/charts/_helpers/charts-analytics.ui';
import { useChartWidgetAnalytics } from '@/app/charts/_hooks/use-chart-widget-analytics';

function resolvePieEmptyMessage(
  seriesLabelField: string | null,
  seriesError: string | null
): string {
  if (!seriesLabelField) {
    return 'Choose a supported Labels column in settings';
  }
  if (seriesError) {
    return seriesError;
  }
  return 'No work items in the selected scope';
}

function useChartsWidgetCardConfig(params: {
  readonly initialConfigOpen: boolean;
  readonly focusedSliceKey?: string;
  readonly viewMode?: ChartWidgetViewMode;
  readonly onViewModeChange?: ChartsWidgetViewModeChangeHandler;
  // eslint-disable-next-line no-unused-vars -- open callback
  readonly onConfigOpenChange?: (open: boolean) => void;
}) {
  const {
    initialConfigOpen,
    focusedSliceKey,
    viewMode,
    onViewModeChange,
    onConfigOpenChange,
  } = params;

  const [configOpen, setConfigOpen] = useState(initialConfigOpen);
  const [configFiltersOpen, setConfigFiltersOpen] = useState(false);
  const [configSettingsOpen, setConfigSettingsOpen] = useState(false);
  const [pendingSliceKey, setPendingSliceKey] = useState<string | null>(null);
  const configCloseResetTimerRef = useRef<number | null>(null);

  const clearConfigCloseResetTimer = () => {
    if (configCloseResetTimerRef.current == null) {
      return;
    }
    window.clearTimeout(configCloseResetTimerRef.current);
    configCloseResetTimerRef.current = null;
  };

  const openConfig = (options?: {
    withFilters?: boolean;
    withSettings?: boolean;
  }) => {
    clearConfigCloseResetTimer();
    setConfigFiltersOpen(Boolean(options?.withFilters));
    setConfigSettingsOpen(Boolean(options?.withSettings));
    setConfigOpen(true);
    onConfigOpenChange?.(true);
  };

  const handleConfigOpenChange = (open: boolean) => {
    setConfigOpen(open);
    onConfigOpenChange?.(open);
    if (open) {
      return;
    }
    clearConfigCloseResetTimer();
    configCloseResetTimerRef.current = window.setTimeout(() => {
      configCloseResetTimerRef.current = null;
      setConfigFiltersOpen(false);
      setConfigSettingsOpen(false);
      setPendingSliceKey(null);
      if (focusedSliceKey != null) {
        onViewModeChange?.(viewMode ?? 'chart', null);
      }
    }, DIALOG_CLOSE_ANIMATION_MS);
  };

  const handleBoardSliceClick = (sliceKey: string) => {
    setPendingSliceKey(sliceKey);
    onViewModeChange?.('split', sliceKey);
    openConfig();
  };

  const handleConfigViewModeChange: ChartsWidgetViewModeChangeHandler = (
    mode,
    nextFocused
  ) => {
    setPendingSliceKey(null);
    onViewModeChange?.(mode, nextFocused);
  };

  useEffect(() => {
    if (pendingSliceKey != null && focusedSliceKey === pendingSliceKey) {
      setPendingSliceKey(null);
    }
  }, [focusedSliceKey, pendingSliceKey]);

  return {
    configOpen,
    configFiltersOpen,
    configSettingsOpen,
    effectiveFocusedSliceKey: pendingSliceKey ?? focusedSliceKey,
    openConfig,
    handleConfigOpenChange,
    handleBoardSliceClick,
    handleConfigViewModeChange,
  };
}

type ChartsWidgetCardProps = {
  readonly title: string;
  readonly typeId: ChartWidgetTypeId;
  readonly description?: string;
  readonly Icon?: ChartWidgetDefinition['icon'];
  readonly filters?: ChartsWidgetFilterDraft;
  /** Fullscreen-only layout; canvas always shows the chart. */
  readonly viewMode?: ChartWidgetViewMode;
  readonly pieVariant?: ChartPieVariant;
  readonly labelField?: ChartsLabelFieldId;
  readonly showValueAs?: 'value' | 'percent';
  readonly sortSlicesBy?:
    'value_desc' | 'value_asc' | 'label_asc' | 'label_desc';
  readonly showEmptySlices?: boolean;
  readonly visibleTableColumns?: readonly ChartsTableColumnId[];
  readonly sliceColors?: Readonly<Record<string, ChartsSliceColorToken>>;
  readonly focusedSliceKey?: string;
  readonly accessibleProjects?: readonly ChartsProjectOption[];
  readonly accessibleSprints?: readonly ChartsSprintOption[];
  readonly assigneeMembers?: readonly ChartsSampleMember[];
  readonly onRemove: () => void;
  readonly onDuplicate: () => void;
  // eslint-disable-next-line no-unused-vars -- rename callback
  readonly onRename: (title: string) => void;
  readonly onFiltersChange?: ChartsWidgetFiltersChangeHandler;
  readonly onViewModeChange?: ChartsWidgetViewModeChangeHandler;
  readonly onPieVariantChange?: ChartsWidgetPieVariantChangeHandler;
  readonly onLabelFieldChange?: ChartsWidgetLabelFieldChangeHandler;
  readonly onDisplaySettingsChange?: (
    // eslint-disable-next-line no-unused-vars
    patch: ChartWidgetDisplaySettingsPatch
  ) => void;
  /** Open config when landing from `/charts/[id]/widget/[widgetId]`. */
  readonly initialConfigOpen?: boolean;
  readonly onConfigOpenChange?: (
    // eslint-disable-next-line no-unused-vars
    open: boolean
  ) => void;
  readonly className?: string;
};

function ChartsWidgetCardChartBody({
  isChart,
  Icon,
  description,
  seriesLabelField,
  analytics,
  pieVariant,
  showValueAs,
  sortSlicesBy,
  showEmptySlices,
  sliceColors,
  configOpen,
  effectiveFocusedSliceKey,
  canClickSlices,
  onBoardSliceClick,
}: Readonly<{
  isChart: boolean;
  Icon?: ChartWidgetDefinition['icon'];
  description?: string;
  seriesLabelField: ChartSeriesLabelField | null;
  analytics: ReturnType<typeof useChartWidgetAnalytics>;
  pieVariant?: ChartPieVariant;
  showValueAs: 'value' | 'percent';
  sortSlicesBy: 'value_desc' | 'value_asc' | 'label_asc' | 'label_desc';
  showEmptySlices: boolean;
  sliceColors?: Readonly<Record<string, ChartsSliceColorToken>>;
  configOpen: boolean;
  effectiveFocusedSliceKey?: string;
  canClickSlices: boolean;
  // eslint-disable-next-line no-unused-vars -- slice click
  onBoardSliceClick: (sliceKey: string) => void;
}>) {
  if (!isChart) {
    return (
      <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
        {Icon ? <Icon className="text-primary/70 size-10 stroke-1" /> : null}
        <p className="text-foreground max-w-xs text-sm leading-snug font-medium">
          {description ?? 'Configure this widget to get started'}
        </p>
        <p className="text-xs">Select a data source to get started</p>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 min-w-0 flex-1 flex-col"
      onMouseDown={(event) => event.stopPropagation()}
    >
      <ChartsStatusPiePreview
        size="card"
        slices={analytics.series?.slices ?? null}
        labelField={seriesLabelField ?? 'status'}
        loading={Boolean(seriesLabelField && analytics.seriesLoading)}
        emptyMessage={resolvePieEmptyMessage(
          seriesLabelField,
          analytics.seriesError
        )}
        pieVariant={pieVariant}
        showValueAs={showValueAs}
        sortSlicesBy={sortSlicesBy}
        showEmptySlices={showEmptySlices}
        sliceColors={sliceColors}
        selectedSliceKey={
          configOpen ? (effectiveFocusedSliceKey ?? null) : null
        }
        onSliceClick={canClickSlices ? onBoardSliceClick : undefined}
      />
    </div>
  );
}

export function ChartsWidgetCard({
  title,
  typeId,
  description,
  Icon,
  filters,
  viewMode,
  pieVariant,
  labelField = DEFAULT_CHARTS_LABEL_FIELD,
  showValueAs = 'percent',
  sortSlicesBy = 'value_desc',
  showEmptySlices = false,
  visibleTableColumns,
  sliceColors,
  focusedSliceKey,
  accessibleProjects = [],
  accessibleSprints = [],
  assigneeMembers = [],
  onRemove,
  onDuplicate,
  onRename,
  onFiltersChange,
  onViewModeChange,
  onPieVariantChange,
  onLabelFieldChange,
  onDisplaySettingsChange,
  initialConfigOpen = false,
  onConfigOpenChange,
  className,
}: Readonly<ChartsWidgetCardProps>) {
  const isChart = typeId === 'chart';
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState(title);
  const {
    configOpen,
    configFiltersOpen,
    configSettingsOpen,
    effectiveFocusedSliceKey,
    openConfig,
    handleConfigOpenChange,
    handleBoardSliceClick,
    handleConfigViewModeChange,
  } = useChartsWidgetCardConfig({
    initialConfigOpen,
    focusedSliceKey,
    viewMode,
    onViewModeChange,
    onConfigOpenChange,
  });

  const projectId = resolveChartAnalyticsProjectId(filters ?? null);
  const sprintId = resolveChartAnalyticsSprintId(filters ?? null);
  const dimensionFilters = useMemo(
    () => resolveChartAnalyticsDimensionFilters(filters ?? null),
    [filters]
  );
  const seriesLabelField = isChartSeriesLabelField(labelField)
    ? labelField
    : null;
  const analytics = useChartWidgetAnalytics({
    projectId: isChart ? projectId : undefined,
    labelField: isChart ? seriesLabelField : null,
    ...(sprintId ? { sprintId } : {}),
    dimensionFilters,
  });

  const openRename = () => {
    setRenameDraft(title);
    setRenameOpen(true);
  };

  const commitRename = () => {
    const next = renameDraft.trim();
    if (next && next !== title) {
      onRename(next);
    }
    setRenameOpen(false);
  };

  const body = (
    <ChartsWidgetCardChartBody
      isChart={isChart}
      Icon={Icon}
      description={description}
      seriesLabelField={seriesLabelField}
      analytics={analytics}
      pieVariant={pieVariant}
      showValueAs={showValueAs}
      sortSlicesBy={sortSlicesBy}
      showEmptySlices={showEmptySlices}
      sliceColors={sliceColors}
      configOpen={configOpen}
      effectiveFocusedSliceKey={effectiveFocusedSliceKey}
      canClickSlices={Boolean(seriesLabelField && onViewModeChange)}
      onBoardSliceClick={handleBoardSliceClick}
    />
  );

  return (
    <>
      <Card
        className={cn(
          'border-border flex h-full min-h-0 flex-col overflow-hidden shadow-none',
          className
        )}
      >
        <CardHeader className="border-border flex shrink-0 flex-row items-center gap-1 space-y-0 border-b px-2 py-1.5">
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Drag ${title}`}
                className="widget-drag-handle text-muted-foreground hover:text-foreground shrink-0 cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Hold to drag</TooltipContent>
          </Tooltip>

          <TruncatedText className="min-w-0 flex-1 px-1 text-sm font-semibold tracking-tight">
            {title}
          </TruncatedText>

          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Filter ${title}`}
                className={cn(
                  'text-muted-foreground hover:text-foreground shrink-0 cursor-pointer',
                  filters && 'text-primary hover:text-primary'
                )}
                onClick={() => {
                  if (isChart) {
                    openConfig({ withFilters: true });
                  }
                }}
                onMouseDown={(event) => event.stopPropagation()}
                disabled={!isChart}
              >
                <Filter className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {isChart ? 'Filters' : 'Filters (chart widgets only for now)'}
            </TooltipContent>
          </Tooltip>

          <ChartsWidgetActionsMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            showExport={isChart}
            showDock
            onRename={openRename}
            onDuplicate={onDuplicate}
            onDelete={onRemove}
            onSettings={
              isChart
                ? () => {
                    openConfig({ withSettings: true });
                  }
                : undefined
            }
            leadingItem={
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onSelect={() => {
                  if (isChart) {
                    openConfig();
                  } else {
                    setFullscreenOpen(true);
                  }
                }}
              >
                <Maximize2 className="size-4" />
                Full screen
              </DropdownMenuItem>
            }
            trigger={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${title} options`}
                className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                onMouseDown={(event) => event.stopPropagation()}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 pt-3">
          {body}
        </CardContent>
      </Card>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rename widget</DialogTitle>
            <DialogDescription>
              Choose a label for this widget instance on the board.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameDraft}
            onChange={(event) => setRenameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitRename();
              }
            }}
            aria-label="Widget name"
            autoFocus
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              onClick={commitRename}
              disabled={!renameDraft.trim()}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isChart ? (
        <ChartsWidgetConfigDialog
          open={configOpen}
          onOpenChange={handleConfigOpenChange}
          title={title}
          initialFiltersOpen={configFiltersOpen}
          initialSettingsOpen={configSettingsOpen}
          filters={filters ?? null}
          viewMode={viewMode}
          pieVariant={pieVariant}
          labelField={labelField}
          showValueAs={showValueAs}
          sortSlicesBy={sortSlicesBy}
          showEmptySlices={showEmptySlices}
          visibleTableColumns={visibleTableColumns}
          sliceColors={sliceColors}
          focusedSliceKey={effectiveFocusedSliceKey}
          accessibleProjects={accessibleProjects}
          accessibleSprints={accessibleSprints}
          assigneeMembers={assigneeMembers}
          onFiltersChange={onFiltersChange}
          onViewModeChange={handleConfigViewModeChange}
          onPieVariantChange={onPieVariantChange}
          onLabelFieldChange={onLabelFieldChange}
          onDisplaySettingsChange={onDisplaySettingsChange}
          onRename={() => {
            window.setTimeout(() => openRename(), 0);
          }}
          onDuplicate={onDuplicate}
          onDelete={onRemove}
        />
      ) : (
        <ChartsFullscreenDialogShell
          open={fullscreenOpen}
          onOpenChange={setFullscreenOpen}
          title={title}
          description={description ?? 'Widget preview'}
          sizeClassName="h-[min(90vh,800px)] w-[min(96vw,1100px)]"
        >
          {body}
        </ChartsFullscreenDialogShell>
      )}
    </>
  );
}
