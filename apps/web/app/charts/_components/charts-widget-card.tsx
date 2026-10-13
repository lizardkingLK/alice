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
import { Label } from '@repo/ui/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  Filter,
  GripVertical,
  Info,
  Maximize2,
  MoreHorizontal,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { ChartSeriesLabelField } from '@repo/types';
import { DIALOG_CLOSE_ANIMATION_MS } from '@/lib/dialog-close';
import type { ChartWidgetDefinition } from '@/app/charts/_components/charts-widget-catalog';
import {
  ChartsDescriptionField,
  useChartsAliceDescriptionSuggest,
} from '@/app/charts/_components/charts-description-field';
import { resolveChartsDescription } from '@/app/charts/_helpers/charts-description';
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
import { ChartsAdvancedFiltersPopover } from '@/app/charts/_components/charts-advanced-filters-popover';
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
import {
  CHARTS_BURNDOWN_DEFAULT_TITLE,
  isBurndownWidgetType,
} from '@/app/charts/_helpers/charts-burndown-widget';
import { useChartWidgetAnalytics } from '@/app/charts/_hooks/use-chart-widget-analytics';
import { useChartWidgetBurndown } from '@/app/charts/_hooks/use-chart-widget-burndown';
import { BurndownLineChart } from '@/components/burndown-line-chart';
import { BurndownScopeLabels } from '@/components/burndown-scope-labels';
import { SIDEBAR_LAYOUT_SETTLE_MS } from '@/hooks/use-sidebar-layout-settling';

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
  /** Persisted instance description (Save option / title tooltip). */
  readonly description?: string;
  /** Catalog blurb for empty / coming-soon widget bodies. */
  readonly catalogDescription?: string;
  readonly Icon?: ChartWidgetDefinition['icon'];
  readonly filters?: ChartsWidgetFilterDraft;
  /** When true, project/sprint filters are locked (create-time scope). */
  readonly scopeLocked?: boolean;
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
  readonly onRename: (
    // eslint-disable-next-line no-unused-vars -- save option callback
    meta: { readonly title: string; readonly description: string | null }
  ) => void;
  readonly onFiltersChange?: ChartsWidgetFiltersChangeHandler;
  readonly onScopeChange?: (
    // eslint-disable-next-line no-unused-vars -- change locked scope
    scope: { readonly projectId: string; readonly sprintId: string | null }
  ) => void;
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
  /** Dashboard Overview: hide filters / settings / mutate actions. */
  readonly overviewChrome?: boolean;
  readonly className?: string;
};

function ChartsWidgetCardBurndownBody({
  burndown,
}: Readonly<{
  burndown: ReturnType<typeof useChartWidgetBurndown>;
}>) {
  if (burndown.loading) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center text-sm">
        Loading burndown…
      </div>
    );
  }

  return (
    <BurndownLineChart
      series={burndown.series}
      estimatedTotal={burndown.estimatedTotal}
      axisRange={burndown.axisRange}
      emptyHint={burndown.emptyHint}
      settleMs={SIDEBAR_LAYOUT_SETTLE_MS}
    />
  );
}

function ChartsWidgetCardChartBody({
  isChart,
  isBurndown,
  Icon,
  description,
  seriesLabelField,
  analytics,
  burndown,
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
  isBurndown: boolean;
  Icon?: ChartWidgetDefinition['icon'];
  description?: string;
  seriesLabelField: ChartSeriesLabelField | null;
  analytics: ReturnType<typeof useChartWidgetAnalytics>;
  burndown: ReturnType<typeof useChartWidgetBurndown>;
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
  if (isBurndown) {
    return <ChartsWidgetCardBurndownBody burndown={burndown} />;
  }

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

  // Drag only starts from `.widget-drag-handle` (DASHBOARD_DRAG_CONFIG); no
  // stopPropagation wrapper needed on the chart body (keeps a11y clean).
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <ChartsStatusPiePreview
        size="card"
        slices={analytics.series?.slices ?? null}
        labelField={seriesLabelField ?? 'category'}
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

function ChartsWidgetCardFilterControl({
  isChart,
  isBurndown,
  title,
  filters,
  scopeLocked,
  typeId,
  burndownFiltersOpen,
  onBurndownFiltersOpenChange,
  accessibleProjects,
  accessibleSprints,
  assigneeMembers,
  onFiltersChange,
  onScopeChange,
  onOpenChartFilters,
}: Readonly<{
  isChart: boolean;
  isBurndown: boolean;
  title: string;
  filters?: ChartsWidgetFilterDraft;
  scopeLocked?: boolean;
  typeId: ChartWidgetTypeId;
  burndownFiltersOpen: boolean;
  // eslint-disable-next-line no-unused-vars -- controlled open
  onBurndownFiltersOpenChange: (open: boolean) => void;
  accessibleProjects: readonly ChartsProjectOption[];
  accessibleSprints: readonly ChartsSprintOption[];
  assigneeMembers: readonly ChartsSampleMember[];
  onFiltersChange?: ChartsWidgetFiltersChangeHandler;
  onScopeChange?: NonNullable<ChartsWidgetCardProps['onScopeChange']>;
  onOpenChartFilters: () => void;
}>) {
  const filterButtonClassName = cn(
    'text-muted-foreground hover:text-foreground shrink-0 cursor-pointer',
    filters && 'text-primary hover:text-primary'
  );

  if (isBurndown) {
    return (
      <ChartsAdvancedFiltersPopover
        open={burndownFiltersOpen}
        onOpenChange={onBurndownFiltersOpenChange}
        onApply={(draft) => onFiltersChange?.(draft)}
        appliedFilters={filters ?? null}
        scopeLocked={scopeLocked}
        typeId={typeId}
        onScopeChange={onScopeChange}
        projects={accessibleProjects}
        sprints={accessibleSprints}
        members={assigneeMembers}
        trigger={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Filter ${title}`}
            aria-expanded={burndownFiltersOpen}
            title="Project and sprint filters"
            className={filterButtonClassName}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <Filter className="size-4" />
          </Button>
        }
      />
    );
  }

  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Filter ${title}`}
          className={filterButtonClassName}
          onClick={() => {
            if (isChart) {
              onOpenChartFilters();
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
  );
}

function resolveWidgetSettingsHandler(params: {
  readonly isChart: boolean;
  readonly isBurndown: boolean;
  readonly openChartSettings: () => void;
  readonly openBurndownFilters: () => void;
}): (() => void) | undefined {
  if (params.isChart) {
    return params.openChartSettings;
  }
  if (params.isBurndown) {
    return params.openBurndownFilters;
  }
  return undefined;
}

export function ChartsWidgetCard({
  title,
  typeId,
  description,
  catalogDescription,
  Icon,
  filters,
  scopeLocked = false,
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
  onScopeChange,
  onViewModeChange,
  onPieVariantChange,
  onLabelFieldChange,
  onDisplaySettingsChange,
  initialConfigOpen = false,
  onConfigOpenChange,
  overviewChrome = false,
  className,
}: Readonly<ChartsWidgetCardProps>) {
  const isChart = typeId === 'chart';
  const isBurndown = isBurndownWidgetType(typeId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [burndownFiltersOpen, setBurndownFiltersOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState(title);
  const [descriptionDraft, setDescriptionDraft] = useState(description ?? '');
  const aliceContext = {
    typeId,
    labelField,
    pieVariant: pieVariant ?? null,
    filters: filters ?? null,
    showValueAs,
    sortSlicesBy,
  };
  const { suggesting, suggestError, suggest, resetSuggestError } =
    useChartsAliceDescriptionSuggest({
      scope: 'widget',
      title: renameDraft,
      description: descriptionDraft,
      onDescriptionChange: setDescriptionDraft,
      context: aliceContext,
    });
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
    initialConfigOpen: isChart ? initialConfigOpen : false,
    focusedSliceKey,
    viewMode,
    onViewModeChange,
    onConfigOpenChange,
  });

  useEffect(() => {
    if (isBurndown && initialConfigOpen) {
      setBurndownFiltersOpen(true);
    }
  }, [isBurndown, initialConfigOpen]);

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
  const burndown = useChartWidgetBurndown(isBurndown ? sprintId : undefined);

  const scopeProjectName =
    accessibleProjects.find((project) => project.id === projectId)?.name ??
    null;
  const scopeSprintName =
    burndown.sprintName ??
    accessibleSprints.find((sprint) => sprint.id === sprintId)?.name ??
    null;

  const openRename = () => {
    setRenameDraft(title);
    setDescriptionDraft(description ?? '');
    resetSuggestError();
    setRenameOpen(true);
  };

  const commitRename = () => {
    const nextTitle = renameDraft.trim();
    if (!nextTitle) {
      return;
    }
    const nextDescription = descriptionDraft.trim() || null;
    const titleChanged = nextTitle !== title;
    const descriptionChanged =
      nextDescription !== (description?.trim() || null);
    if (titleChanged || descriptionChanged) {
      onRename({ title: nextTitle, description: nextDescription });
    }
    setRenameOpen(false);
  };

  const displayTitle =
    title.trim() || (isBurndown ? CHARTS_BURNDOWN_DEFAULT_TITLE : 'Widget');

  const onSettings = resolveWidgetSettingsHandler({
    isChart,
    isBurndown,
    openChartSettings: () => {
      openConfig({ withSettings: true });
    },
    openBurndownFilters: () => {
      setBurndownFiltersOpen(true);
    },
  });

  const body = (
    <ChartsWidgetCardChartBody
      isChart={isChart}
      isBurndown={isBurndown}
      Icon={Icon}
      description={catalogDescription}
      seriesLabelField={seriesLabelField}
      analytics={analytics}
      burndown={burndown}
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
                aria-label={`Drag ${displayTitle}`}
                className="widget-drag-handle text-muted-foreground hover:text-foreground shrink-0 cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Hold to drag</TooltipContent>
          </Tooltip>

          <div className="flex min-w-0 flex-1 items-center gap-1 px-1">
            <TruncatedText className="min-w-0 text-sm font-semibold tracking-tight">
              {displayTitle}
            </TruncatedText>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground inline-flex shrink-0 cursor-pointer"
                  aria-label={`${displayTitle} description`}
                >
                  <Info className="size-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-left">
                {resolveChartsDescription({
                  description,
                  title: displayTitle,
                  typeId,
                })}
              </TooltipContent>
            </Tooltip>
          </div>

          {isBurndown || isChart ? (
            <BurndownScopeLabels
              projectName={scopeProjectName}
              sprintName={scopeSprintName}
              className="mr-1 hidden sm:flex"
            />
          ) : null}

          {overviewChrome ? null : (
            <ChartsWidgetCardFilterControl
              isChart={isChart}
              isBurndown={isBurndown}
              title={displayTitle}
              filters={filters}
              scopeLocked={scopeLocked}
              typeId={typeId}
              burndownFiltersOpen={burndownFiltersOpen}
              onBurndownFiltersOpenChange={setBurndownFiltersOpen}
              accessibleProjects={accessibleProjects}
              accessibleSprints={accessibleSprints}
              assigneeMembers={assigneeMembers}
              onFiltersChange={onFiltersChange}
              onScopeChange={onScopeChange}
              onOpenChartFilters={() => {
                openConfig({ withFilters: true });
              }}
            />
          )}

          <ChartsWidgetActionsMenu
            open={menuOpen}
            onOpenChange={setMenuOpen}
            showExport={isChart}
            showDock={!overviewChrome}
            overviewChrome={overviewChrome}
            onRename={openRename}
            onDuplicate={onDuplicate}
            onDelete={onRemove}
            onSettings={overviewChrome ? undefined : onSettings}
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
                aria-label={`${displayTitle} options`}
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

      <Dialog
        open={renameOpen}
        onOpenChange={(open) => {
          if (suggesting) {
            return;
          }
          setRenameOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save option</DialogTitle>
            <DialogDescription>
              Update the name and description for this widget on the board.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="chart-widget-title">Name</Label>
              <Input
                id="chart-widget-title"
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
                disabled={suggesting}
              />
            </div>
            <ChartsDescriptionField
              id="chart-widget-description"
              value={descriptionDraft}
              onChange={setDescriptionDraft}
              title={renameDraft}
              suggesting={suggesting}
              suggestError={suggestError}
              onSuggest={() => {
                suggest().catch(() => {});
              }}
              placeholder="What this widget shows…"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              className="cursor-pointer"
              disabled={suggesting}
              onClick={() => setRenameOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="cursor-pointer"
              onClick={commitRename}
              disabled={!renameDraft.trim() || suggesting}
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
          scopeLocked={scopeLocked}
          typeId={typeId}
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
          onScopeChange={onScopeChange}
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
          title={displayTitle}
          description={resolveChartsDescription({
            description:
              description ??
              (isBurndown
                ? 'Sprint remaining work versus the ideal line'
                : catalogDescription),
            title: displayTitle,
            typeId,
          })}
          sizeClassName="h-[min(90vh,800px)] w-[min(96vw,1100px)]"
        >
          {body}
        </ChartsFullscreenDialogShell>
      )}
    </>
  );
}
