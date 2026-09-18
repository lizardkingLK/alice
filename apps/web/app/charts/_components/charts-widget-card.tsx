'use client';

import { useState } from 'react';
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
import type { ChartWidgetDefinition } from '@/app/charts/_components/charts-widget-catalog';
import type {
  ChartPieVariant,
  ChartsLabelFieldId,
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
  type ChartsWidgetFilterDraft,
} from '@/app/charts/_components/charts-sample.data';
import { ChartsFullscreenDialogShell } from '@/app/charts/_components/charts-fullscreen-dialog-shell';
import { ChartsStatusPiePreview } from '@/app/charts/_components/charts-status-pie-preview';
import { ChartsWidgetActionsMenu } from '@/app/charts/_components/charts-widget-actions-menu';
import { ChartsWidgetConfigDialog } from '@/app/charts/_components/charts-widget-config-dialog';
import {
  isChartSeriesLabelField,
  resolveChartAnalyticsProjectId,
} from '@/app/charts/_helpers/charts-analytics.ui';
import { useChartWidgetAnalytics } from '@/app/charts/_hooks/use-chart-widget-analytics';

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
  readonly focusedSliceKey?: string;
  readonly accessibleProjects?: readonly ChartsProjectOption[];
  readonly onRemove: () => void;
  readonly onDuplicate: () => void;
  // eslint-disable-next-line no-unused-vars -- rename callback
  readonly onRename: (title: string) => void;
  readonly onFiltersChange?: ChartsWidgetFiltersChangeHandler;
  readonly onViewModeChange?: ChartsWidgetViewModeChangeHandler;
  readonly onPieVariantChange?: ChartsWidgetPieVariantChangeHandler;
  readonly onLabelFieldChange?: ChartsWidgetLabelFieldChangeHandler;
  /** Open config when landing from `/charts/[id]/widget/[widgetId]`. */
  readonly initialConfigOpen?: boolean;
  readonly onConfigOpenChange?: (
    // eslint-disable-next-line no-unused-vars
    open: boolean
  ) => void;
  readonly className?: string;
};

export function ChartsWidgetCard({
  title,
  typeId,
  description,
  Icon,
  filters,
  viewMode,
  pieVariant,
  labelField = DEFAULT_CHARTS_LABEL_FIELD,
  focusedSliceKey,
  accessibleProjects = [],
  onRemove,
  onDuplicate,
  onRename,
  onFiltersChange,
  onViewModeChange,
  onPieVariantChange,
  onLabelFieldChange,
  initialConfigOpen = false,
  onConfigOpenChange,
  className,
}: Readonly<ChartsWidgetCardProps>) {
  const isChart = typeId === 'chart';
  const [menuOpen, setMenuOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(initialConfigOpen);
  const [configFiltersOpen, setConfigFiltersOpen] = useState(false);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState(title);

  const projectId = resolveChartAnalyticsProjectId(filters ?? null);
  const seriesLabelField = isChartSeriesLabelField(labelField)
    ? labelField
    : null;
  const analytics = useChartWidgetAnalytics({
    projectId: isChart ? projectId : null,
    labelField: isChart ? seriesLabelField : null,
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

  const openConfig = (withFilters: boolean) => {
    setConfigFiltersOpen(withFilters);
    setConfigOpen(true);
    onConfigOpenChange?.(true);
  };

  const handleConfigOpenChange = (open: boolean) => {
    setConfigOpen(open);
    onConfigOpenChange?.(open);
    if (!open) {
      setConfigFiltersOpen(false);
    }
  };

  const placeholderBody = (
    <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 px-4 text-center">
      {Icon ? <Icon className="text-primary/70 size-10 stroke-1" /> : null}
      <p className="text-foreground max-w-xs text-sm leading-snug font-medium">
        {description ?? 'Configure this widget to get started'}
      </p>
      <p className="text-xs">Select a data source to get started</p>
    </div>
  );

  let pieEmptyMessage = 'No work items in this project';
  if (!projectId) {
    pieEmptyMessage = 'Select a project in filters to load chart data';
  } else if (!seriesLabelField) {
    pieEmptyMessage = 'Choose a supported Labels column in settings';
  } else if (analytics.seriesError) {
    pieEmptyMessage = analytics.seriesError;
  }

  const body = isChart ? (
    <ChartsStatusPiePreview
      size="card"
      slices={analytics.series?.slices ?? null}
      labelField={seriesLabelField ?? 'status'}
      loading={Boolean(
        projectId && seriesLabelField && analytics.seriesLoading
      )}
      emptyMessage={pieEmptyMessage}
      pieVariant={pieVariant}
    />
  ) : (
    placeholderBody
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
                    openConfig(true);
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
            leadingItem={
              <DropdownMenuItem
                className="cursor-pointer gap-2"
                onSelect={() => {
                  if (isChart) {
                    openConfig(false);
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
          filters={filters ?? null}
          viewMode={viewMode}
          pieVariant={pieVariant}
          labelField={labelField}
          focusedSliceKey={focusedSliceKey}
          accessibleProjects={accessibleProjects}
          onFiltersChange={onFiltersChange}
          onViewModeChange={onViewModeChange}
          onPieVariantChange={onPieVariantChange}
          onLabelFieldChange={onLabelFieldChange}
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
          {placeholderBody}
        </ChartsFullscreenDialogShell>
      )}
    </>
  );
}
