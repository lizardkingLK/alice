'use client';

import { useMemo } from 'react';
import ReactGridLayout, {
  type Layout,
  type LayoutItem,
} from 'react-grid-layout';
import { BarChart3 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { ChartsWidgetCard } from '@/app/charts/_components/charts-widget-card';
import { ChartsPieWidgetSkeleton } from '@/app/charts/_components/charts-workspace-skeleton';
import {
  DASHBOARD_DRAG_CONFIG,
  DASHBOARD_GRID_CONFIG,
  DASHBOARD_RESIZE_CONFIG,
  useCancelGridDragOnEscape,
  useStableDashboardGridWidth,
} from '@/lib/dashboard-grid';
import {
  chartWidgetById,
  type ChartWidgetDefinition,
} from '@/app/charts/_components/charts-widget-catalog';
import type {
  ChartBoardWidgetInstance,
  ChartPieVariant,
  ChartsLabelFieldId,
  ChartWidgetDisplaySettingsPatch,
  ChartWidgetViewMode,
} from '@/app/charts/_components/charts.types';
import type {
  ChartsProjectOption,
  ChartsSampleMember,
} from '@/app/charts/_components/charts-sample.data';
import {
  chartLayoutsEqual,
  reconcileChartBoardLayout,
} from '@/app/charts/_helpers/charts-board-layout';
import { resolveFocusedSliceKey } from '@/app/charts/_helpers/charts-board-widget-fields';
import { defaultTitleForChartWidgetType } from '@/app/charts/_helpers/charts-burndown-widget';
import 'react-grid-layout/css/styles.css';
import '@/app/dashboard/_components/dashboard-grid.css';

export {
  createChartWidgetInstanceId,
  layoutSizeForWidgetType,
  nextChartLayoutItem,
  reconcileChartBoardLayout,
} from '@/app/charts/_helpers/charts-board-layout';
export {
  updateChartWidgetDisplaySettings,
  updateChartWidgetFilters,
  updateChartWidgetLabelField,
  updateChartWidgetPieVariant,
  updateChartWidgetViewMode,
} from '@/app/charts/_helpers/charts-board-widget-fields';
export {
  appendChartWidget,
  duplicateChartWidget,
  removeChartWidget,
  renameChartWidget,
  saveChartWidgetMeta,
} from '@/app/charts/_helpers/charts-board-widget-ops';

type ChartsBoardCanvasProps = {
  readonly instances: readonly ChartBoardWidgetInstance[];
  readonly layout: LayoutItem[];
  // eslint-disable-next-line no-unused-vars -- layout change
  readonly onLayoutChange: (layout: LayoutItem[]) => void;
  // eslint-disable-next-line no-unused-vars -- remove instance
  readonly onRemoveWidget: (instanceId: string) => void;
  // eslint-disable-next-line no-unused-vars -- duplicate instance
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
    filters: ChartBoardWidgetInstance['filters'] | null
  ) => void;
  readonly onScopeChange?: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    scope: { readonly projectId: string; readonly sprintId: string | null }
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
  readonly focusWidgetId?: string;
  readonly onFocusWidgetDismiss?: () => void;
  /** Accessible projects for Chart widget filters / series / State labels. */
  readonly accessibleProjects?: readonly ChartsProjectOption[];
  /** Active sprints for Chart widget sprint filter (project-scoped). */
  readonly accessibleSprints?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly projectId: string;
  }>;
  readonly assigneeMembers?: readonly ChartsSampleMember[];
  /** False until localStorage board JSON has been read on the client. */
  readonly hydrated?: boolean;
  /** Dashboard Overview: hide mutate chrome; optionally lock layout. */
  readonly overviewChrome?: boolean;
  readonly layoutLocked?: boolean;
  readonly className?: string;
};

export function ChartsBoardCanvas({
  instances,
  layout,
  onLayoutChange,
  onRemoveWidget,
  onDuplicateWidget,
  onRenameWidget,
  onFiltersChange,
  onScopeChange,
  onViewModeChange,
  onPieVariantChange,
  onLabelFieldChange,
  onDisplaySettingsChange,
  focusWidgetId,
  onFocusWidgetDismiss,
  accessibleProjects = [],
  accessibleSprints = [],
  assigneeMembers = [],
  hydrated = true,
  overviewChrome = false,
  layoutLocked = false,
  className,
}: Readonly<ChartsBoardCanvasProps>) {
  const { stableWidth, containerRef, mounted, isSidebarSettling } =
    useStableDashboardGridWidth();

  const instanceById = useMemo(() => {
    const map = new Map<
      string,
      {
        instance: ChartBoardWidgetInstance;
        meta: ChartWidgetDefinition | undefined;
      }
    >();
    for (const instance of instances) {
      map.set(instance.instanceId, {
        instance,
        meta: chartWidgetById(instance.typeId),
      });
    }
    return map;
  }, [instances]);

  const isEmpty = hydrated && instances.length === 0;
  const displayLayout = useMemo(
    () => reconcileChartBoardLayout(instances, layout),
    [instances, layout]
  );

  const handleLayoutChange = (next: Layout) => {
    const reconciled = reconcileChartBoardLayout(instances, next);
    if (chartLayoutsEqual(reconciled, layout)) {
      return;
    }
    onLayoutChange(reconciled);
  };

  if (!hydrated) {
    return (
      <div
        className={cn(
          'grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3',
          className
        )}
        aria-busy="true"
        aria-label="Loading chart board"
      >
        <ChartsPieWidgetSkeleton />
        <ChartsPieWidgetSkeleton />
        <ChartsPieWidgetSkeleton className="sm:col-span-2 xl:col-span-1" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3',
        className
      )}
    >
      <div
        ref={containerRef}
        className={cn(
          'dashboard-grid min-h-0 w-full min-w-0 flex-1 transition-opacity duration-150',
          isEmpty && 'flex',
          isSidebarSettling && 'pointer-events-none opacity-80'
        )}
      >
        <BoardCanvasBody
          isEmpty={isEmpty}
          mounted={mounted}
          stableWidth={stableWidth}
          layout={displayLayout}
          instanceById={instanceById}
          onLayoutChange={handleLayoutChange}
          onRemoveWidget={onRemoveWidget}
          onDuplicateWidget={onDuplicateWidget}
          onRenameWidget={onRenameWidget}
          onFiltersChange={onFiltersChange}
          onScopeChange={onScopeChange}
          onViewModeChange={onViewModeChange}
          onPieVariantChange={onPieVariantChange}
          onLabelFieldChange={onLabelFieldChange}
          onDisplaySettingsChange={onDisplaySettingsChange}
          focusWidgetId={focusWidgetId}
          onFocusWidgetDismiss={onFocusWidgetDismiss}
          accessibleProjects={accessibleProjects}
          accessibleSprints={accessibleSprints}
          assigneeMembers={assigneeMembers}
          overviewChrome={overviewChrome}
          layoutLocked={layoutLocked}
        />
      </div>
    </div>
  );
}

function BoardCanvasBody({
  isEmpty,
  mounted,
  stableWidth,
  layout,
  instanceById,
  onLayoutChange,
  onRemoveWidget,
  onDuplicateWidget,
  onRenameWidget,
  onFiltersChange,
  onScopeChange,
  onViewModeChange,
  onPieVariantChange,
  onLabelFieldChange,
  onDisplaySettingsChange,
  focusWidgetId,
  onFocusWidgetDismiss,
  accessibleProjects = [],
  accessibleSprints = [],
  assigneeMembers = [],
  overviewChrome = false,
  layoutLocked = false,
}: Readonly<{
  isEmpty: boolean;
  mounted: boolean;
  stableWidth: number;
  layout: LayoutItem[];
  instanceById: Map<
    string,
    {
      instance: ChartBoardWidgetInstance;
      meta: ChartWidgetDefinition | undefined;
    }
  >;
  // eslint-disable-next-line no-unused-vars
  onLayoutChange: (next: Layout) => void;
  // eslint-disable-next-line no-unused-vars
  onRemoveWidget: (instanceId: string) => void;
  // eslint-disable-next-line no-unused-vars
  onDuplicateWidget: (instanceId: string) => void;
  onRenameWidget: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    meta: { readonly title: string; readonly description: string | null }
  ) => void;
  onFiltersChange: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    filters: ChartBoardWidgetInstance['filters'] | null
  ) => void;
  onScopeChange?: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    scope: { readonly projectId: string; readonly sprintId: string | null }
  ) => void;
  onViewModeChange: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    viewMode: ChartWidgetViewMode,
    // eslint-disable-next-line no-unused-vars
    focusedSliceKey?: string | null
  ) => void;
  onPieVariantChange: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    pieVariant: ChartPieVariant
  ) => void;
  onLabelFieldChange: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    labelField: ChartsLabelFieldId
  ) => void;
  onDisplaySettingsChange: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    patch: ChartWidgetDisplaySettingsPatch
  ) => void;
  focusWidgetId?: string;
  onFocusWidgetDismiss?: () => void;
  accessibleProjects?: readonly ChartsProjectOption[];
  accessibleSprints?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly projectId: string;
  }>;
  assigneeMembers?: readonly ChartsSampleMember[];
  overviewChrome?: boolean;
  layoutLocked?: boolean;
}>) {
  const { dragSessionKey, onDragStart, onDragStop } =
    useCancelGridDragOnEscape(onLayoutChange);

  if (isEmpty) {
    return (
      <div className="border-border text-muted-foreground flex min-h-72 flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
        <BarChart3
          className="text-muted-foreground size-10 stroke-[1.5]"
          aria-hidden
        />
        <p className="text-foreground text-sm font-medium">No widgets yet</p>
        <p className="max-w-sm text-sm leading-relaxed">
          Use the <span className="text-foreground font-medium">+</span> button
          to add a Chart widget to this workspace.
        </p>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div
        className="grid min-h-72 flex-1 grid-cols-1 gap-4 sm:grid-cols-2"
        aria-busy="true"
        aria-label="Preparing chart board"
      >
        <ChartsPieWidgetSkeleton />
        <ChartsPieWidgetSkeleton className="hidden sm:block" />
      </div>
    );
  }

  return (
    <ReactGridLayout
      key={dragSessionKey}
      className="layout"
      width={stableWidth}
      layout={layout}
      gridConfig={DASHBOARD_GRID_CONFIG}
      dragConfig={{
        ...DASHBOARD_DRAG_CONFIG,
        enabled: !layoutLocked && DASHBOARD_DRAG_CONFIG.enabled,
      }}
      resizeConfig={{
        ...DASHBOARD_RESIZE_CONFIG,
        enabled: !layoutLocked && DASHBOARD_RESIZE_CONFIG.enabled,
      }}
      onLayoutChange={onLayoutChange}
      onDragStart={onDragStart}
      onDragStop={onDragStop}
    >
      {layout.map((item) => {
        const entry = instanceById.get(item.i);
        const meta = entry?.meta;
        const catalogTitle = meta?.title || 'Widget';
        const displayTitle =
          entry?.instance.title?.trim() ||
          (entry?.instance.typeId
            ? defaultTitleForChartWidgetType(entry.instance.typeId)
            : catalogTitle);
        return (
          <div key={item.i} className="dashboard-widget-root">
            <ChartsWidgetCard
              title={displayTitle}
              typeId={entry?.instance.typeId ?? 'chart'}
              description={entry?.instance.description}
              catalogDescription={meta?.description}
              Icon={meta?.icon}
              filters={entry?.instance.filters}
              scopeLocked={entry?.instance.scopeLocked}
              viewMode={entry?.instance.viewMode}
              pieVariant={entry?.instance.pieVariant}
              labelField={entry?.instance.labelField}
              showValueAs={entry?.instance.showValueAs}
              sortSlicesBy={entry?.instance.sortSlicesBy}
              showEmptySlices={entry?.instance.showEmptySlices}
              visibleTableColumns={entry?.instance.visibleTableColumns}
              sliceColors={entry?.instance.sliceColors}
              focusedSliceKey={resolveFocusedSliceKey(entry?.instance ?? {})}
              accessibleProjects={accessibleProjects}
              accessibleSprints={accessibleSprints}
              assigneeMembers={assigneeMembers}
              onRemove={() => onRemoveWidget(item.i)}
              onDuplicate={() => onDuplicateWidget(item.i)}
              onRename={(metaPayload) => onRenameWidget(item.i, metaPayload)}
              onFiltersChange={(nextFilters) =>
                onFiltersChange(item.i, nextFilters)
              }
              onScopeChange={
                onScopeChange
                  ? (scope) => onScopeChange(item.i, scope)
                  : undefined
              }
              onViewModeChange={(nextMode, nextFocused) =>
                onViewModeChange(item.i, nextMode, nextFocused)
              }
              onPieVariantChange={(nextVariant) =>
                onPieVariantChange(item.i, nextVariant)
              }
              onLabelFieldChange={(nextField) =>
                onLabelFieldChange(item.i, nextField)
              }
              onDisplaySettingsChange={(patch) =>
                onDisplaySettingsChange(item.i, patch)
              }
              initialConfigOpen={focusWidgetId === item.i}
              onConfigOpenChange={(open) => {
                if (!open && focusWidgetId === item.i) {
                  onFocusWidgetDismiss?.();
                }
              }}
              overviewChrome={overviewChrome}
            />
          </div>
        );
      })}
    </ReactGridLayout>
  );
}
