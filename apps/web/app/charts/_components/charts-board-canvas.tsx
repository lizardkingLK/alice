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
  ChartWidgetTypeId,
  ChartWidgetViewMode,
} from '@/app/charts/_components/charts.types';
import type {
  ChartsSampleMember,
  ChartsWidgetFilterDraft,
} from '@/app/charts/_components/charts-sample.data';
import 'react-grid-layout/css/styles.css';
import '@/app/dashboard/_components/dashboard-grid.css';

/**
 * Older board JSON stored status focus as `focusedStatus`.
 * Prefer `focusedSliceKey` everywhere going forward.
 */
function resolveFocusedSliceKey(source: {
  readonly focusedSliceKey?: string;
  readonly focusedStatus?: string;
}): string | undefined {
  return source.focusedSliceKey ?? source.focusedStatus;
}

const DEFAULT_SIZE = {
  w: 4,
  h: 5,
  minW: 2,
  minH: 3,
} as const;

/** Pie / chart widgets need a medium footprint so the viz stays readable. */
const CHART_TYPE_SIZE = {
  w: 5,
  h: 6,
  minW: 3,
  minH: 4,
} as const;

export function layoutSizeForWidgetType(typeId: ChartWidgetTypeId): {
  readonly w: number;
  readonly h: number;
  readonly minW: number;
  readonly minH: number;
} {
  if (typeId === 'chart') {
    return CHART_TYPE_SIZE;
  }
  return DEFAULT_SIZE;
}

export function createChartWidgetInstanceId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `widget-${Date.now()}`;
}

function layoutItemsCollide(
  a: Pick<LayoutItem, 'x' | 'y' | 'w' | 'h'>,
  b: Pick<LayoutItem, 'x' | 'y' | 'w' | 'h'>
): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}

function findOpenLayoutSlot(
  existing: LayoutItem[],
  size: Pick<LayoutItem, 'w' | 'h'>,
  cols: number
): { x: number; y: number } {
  if (existing.length === 0) {
    return { x: 0, y: 0 };
  }

  const occupiedHeight = existing.reduce(
    (acc, item) => Math.max(acc, item.y + item.h),
    0
  );
  // Scan existing rows (and one row past the bottom) for the first free fit.
  const maxScanY = occupiedHeight;

  for (let y = 0; y <= maxScanY; y += 1) {
    for (let x = 0; x <= cols - size.w; x += 1) {
      const candidate = { x, y, w: size.w, h: size.h };
      const collides = existing.some((item) =>
        layoutItemsCollide(candidate, item)
      );
      if (!collides) {
        return { x, y };
      }
    }
  }

  return { x: 0, y: occupiedHeight };
}

export function nextChartLayoutItem(
  instanceId: string,
  existing: LayoutItem[],
  typeId: ChartWidgetTypeId = 'chart',
  sizeOverride?: Partial<Pick<LayoutItem, 'w' | 'h' | 'minW' | 'minH'>>
): LayoutItem {
  const defaults = layoutSizeForWidgetType(typeId);
  const size = {
    w: sizeOverride?.w ?? defaults.w,
    h: sizeOverride?.h ?? defaults.h,
    minW: sizeOverride?.minW ?? defaults.minW,
    minH: sizeOverride?.minH ?? defaults.minH,
  };
  const cols = DASHBOARD_GRID_CONFIG.cols;
  const slot = findOpenLayoutSlot(existing, size, cols);

  return {
    i: instanceId,
    x: slot.x,
    y: slot.y,
    w: size.w,
    h: size.h,
    minW: size.minW,
    minH: size.minH,
  };
}

/**
 * Ensure every widget instance has a layout item. Repairs boards after a
 * spurious react-grid-layout `onLayoutChange([])` (common when adding the
 * first widget) or cloud hydrate with mismatched board_json.
 */
export function reconcileChartBoardLayout(
  instances: readonly ChartBoardWidgetInstance[],
  layout: readonly LayoutItem[]
): LayoutItem[] {
  if (instances.length === 0) {
    return [];
  }

  const layoutById = new Map<string, LayoutItem>();
  for (const item of layout) {
    if (typeof item.i === 'string') {
      layoutById.set(item.i, item);
    }
  }

  const next: LayoutItem[] = [];
  for (const instance of instances) {
    const stored = layoutById.get(instance.instanceId);
    if (stored) {
      const size = layoutSizeForWidgetType(instance.typeId);
      next.push({
        ...stored,
        minW: size.minW,
        minH: size.minH,
      });
      continue;
    }
    next.push(nextChartLayoutItem(instance.instanceId, next, instance.typeId));
  }
  return next;
}

function chartLayoutsEqual(
  left: readonly LayoutItem[],
  right: readonly LayoutItem[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]!;
    const b = right[index]!;
    if (
      a.i !== b.i ||
      a.x !== b.x ||
      a.y !== b.y ||
      a.w !== b.w ||
      a.h !== b.h
    ) {
      return false;
    }
  }
  return true;
}

type ChartsBoardCanvasProps = {
  readonly instances: readonly ChartBoardWidgetInstance[];
  readonly layout: LayoutItem[];
  // eslint-disable-next-line no-unused-vars -- layout change
  readonly onLayoutChange: (layout: LayoutItem[]) => void;
  // eslint-disable-next-line no-unused-vars -- remove instance
  readonly onRemoveWidget: (instanceId: string) => void;
  // eslint-disable-next-line no-unused-vars -- duplicate instance
  readonly onDuplicateWidget: (instanceId: string) => void;
  // eslint-disable-next-line no-unused-vars -- rename instance
  readonly onRenameWidget: (instanceId: string, title: string) => void;
  readonly onFiltersChange: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    filters: ChartBoardWidgetInstance['filters'] | null
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
  /** Accessible projects for Chart widget filters / series. */
  readonly accessibleProjects?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  /** Active sprints for Chart widget sprint filter (project-scoped). */
  readonly accessibleSprints?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly projectId: string;
  }>;
  readonly assigneeMembers?: readonly ChartsSampleMember[];
  /** False until localStorage board JSON has been read on the client. */
  readonly hydrated?: boolean;
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
          onViewModeChange={onViewModeChange}
          onPieVariantChange={onPieVariantChange}
          onLabelFieldChange={onLabelFieldChange}
          onDisplaySettingsChange={onDisplaySettingsChange}
          focusWidgetId={focusWidgetId}
          onFocusWidgetDismiss={onFocusWidgetDismiss}
          accessibleProjects={accessibleProjects}
          accessibleSprints={accessibleSprints}
          assigneeMembers={assigneeMembers}
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
  onViewModeChange,
  onPieVariantChange,
  onLabelFieldChange,
  onDisplaySettingsChange,
  focusWidgetId,
  onFocusWidgetDismiss,
  accessibleProjects = [],
  accessibleSprints = [],
  assigneeMembers = [],
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
  // eslint-disable-next-line no-unused-vars
  onRenameWidget: (instanceId: string, title: string) => void;
  onFiltersChange: (
    // eslint-disable-next-line no-unused-vars
    instanceId: string,
    // eslint-disable-next-line no-unused-vars
    filters: ChartBoardWidgetInstance['filters'] | null
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
  accessibleProjects?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
  accessibleSprints?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
    readonly projectId: string;
  }>;
  assigneeMembers?: readonly ChartsSampleMember[];
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
      dragConfig={DASHBOARD_DRAG_CONFIG}
      resizeConfig={DASHBOARD_RESIZE_CONFIG}
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
          (entry?.instance.typeId === 'chart'
            ? 'Tasks by status'
            : catalogTitle);
        return (
          <div key={item.i} className="dashboard-widget-root">
            <ChartsWidgetCard
              title={displayTitle}
              typeId={entry?.instance.typeId ?? 'chart'}
              description={meta?.description}
              Icon={meta?.icon}
              filters={entry?.instance.filters}
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
              onRename={(nextTitle) => onRenameWidget(item.i, nextTitle)}
              onFiltersChange={(nextFilters) =>
                onFiltersChange(item.i, nextFilters)
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
            />
          </div>
        );
      })}
    </ReactGridLayout>
  );
}

/** Helper for parent: append a widget of the given type. */
export function appendChartWidget(
  typeId: ChartWidgetTypeId,
  instances: ChartBoardWidgetInstance[],
  layout: LayoutItem[],
  options?: {
    title?: string;
    sizeOverride?: Partial<Pick<LayoutItem, 'w' | 'h' | 'minW' | 'minH'>>;
    filters?: ChartsWidgetFilterDraft;
  }
): {
  instances: ChartBoardWidgetInstance[];
  layout: LayoutItem[];
} {
  const instanceId = createChartWidgetInstanceId();
  const nextInstances = [
    ...instances,
    {
      instanceId,
      typeId,
      ...(options?.title ? { title: options.title } : {}),
      ...(options?.filters ? { filters: options.filters } : {}),
    },
  ];
  const nextLayout = [
    ...layout,
    nextChartLayoutItem(instanceId, layout, typeId, options?.sizeOverride),
  ];
  return { instances: nextInstances, layout: nextLayout };
}

export function removeChartWidget(
  instanceId: string,
  instances: ChartBoardWidgetInstance[],
  layout: LayoutItem[]
): {
  instances: ChartBoardWidgetInstance[];
  layout: LayoutItem[];
} {
  return {
    instances: instances.filter((item) => item.instanceId !== instanceId),
    layout: layout.filter((item) => item.i !== instanceId),
  };
}

export function duplicateChartWidget(
  instanceId: string,
  instances: ChartBoardWidgetInstance[],
  layout: LayoutItem[]
): {
  instances: ChartBoardWidgetInstance[];
  layout: LayoutItem[];
} {
  const source = instances.find((item) => item.instanceId === instanceId);
  if (!source) {
    return { instances, layout };
  }

  const catalogTitle = chartWidgetById(source.typeId)?.title;
  const displayFallback =
    source.typeId === 'chart' ? 'Tasks by status' : catalogTitle;
  const baseTitle = source.title?.trim() || displayFallback || 'Widget';
  const sourceLayout = layout.find((item) => item.i === instanceId);
  const sizeOverride = sourceLayout
    ? {
        w: sourceLayout.w,
        h: sourceLayout.h,
        minW: sourceLayout.minW,
        minH: sourceLayout.minH,
      }
    : undefined;

  const next = appendChartWidget(source.typeId, instances, layout, {
    title: `${baseTitle} (copy)`,
    sizeOverride,
  });
  const copiedId = next.instances.at(-1)?.instanceId;
  if (!copiedId) {
    return next;
  }

  let nextInstances = next.instances;
  if (source.filters) {
    nextInstances = updateChartWidgetFilters(
      copiedId,
      source.filters,
      nextInstances
    );
  }
  const sourceFocus = resolveFocusedSliceKey(source);
  if (source.viewMode || sourceFocus) {
    nextInstances = updateChartWidgetViewMode(
      copiedId,
      source.viewMode ?? 'chart',
      sourceFocus ?? null,
      nextInstances
    );
  }
  if (source.pieVariant && source.pieVariant !== 'donut') {
    nextInstances = updateChartWidgetPieVariant(
      copiedId,
      source.pieVariant,
      nextInstances
    );
  }
  if (source.labelField && source.labelField !== 'status') {
    nextInstances = updateChartWidgetLabelField(
      copiedId,
      source.labelField,
      nextInstances
    );
  }
  return { ...next, instances: nextInstances };
}

export function renameChartWidget(
  instanceId: string,
  title: string,
  instances: ChartBoardWidgetInstance[]
): ChartBoardWidgetInstance[] {
  const trimmed = title.trim();
  return instances.map((item) =>
    item.instanceId === instanceId ? { ...item, title: trimmed } : item
  );
}

type ChartInstanceFieldPatch = Partial<
  Pick<
    ChartBoardWidgetInstance,
    | 'title'
    | 'filters'
    | 'viewMode'
    | 'focusedSliceKey'
    | 'pieVariant'
    | 'labelField'
    | 'showValueAs'
    | 'sortSlicesBy'
    | 'showEmptySlices'
    | 'visibleTableColumns'
    | 'sliceColors'
  >
> & {
  readonly clearFilters?: boolean;
  readonly clearFocusedSliceKey?: boolean;
  readonly clearPieVariant?: boolean;
  readonly clearLabelField?: boolean;
  readonly clearShowValueAs?: boolean;
  readonly clearSortSlicesBy?: boolean;
  readonly clearShowEmptySlices?: boolean;
  readonly clearVisibleTableColumns?: boolean;
  readonly clearSliceColors?: boolean;
};

/** Persist a field only when set and not the omitted default. */
function assignNonDefaultField<K extends keyof ChartBoardWidgetInstance>(
  target: ChartBoardWidgetInstance,
  key: K,
  value: ChartBoardWidgetInstance[K] | undefined,
  isOmittedDefault: boolean
): void {
  if (value == null || isOmittedDefault) {
    return;
  }
  Object.assign(target, { [key]: value });
}

function assignUnlessCleared<K extends keyof ChartBoardWidgetInstance>(
  target: ChartBoardWidgetInstance,
  cleared: boolean | undefined,
  key: K,
  value: ChartBoardWidgetInstance[K] | undefined,
  isOmittedDefault = false
): void {
  if (cleared) {
    return;
  }
  assignNonDefaultField(target, key, value, isOmittedDefault);
}

function withInstanceFields(
  item: ChartBoardWidgetInstance,
  patch: ChartInstanceFieldPatch
): ChartBoardWidgetInstance {
  const next: ChartBoardWidgetInstance = {
    instanceId: item.instanceId,
    typeId: item.typeId,
  };

  const title = patch.title ?? item.title;
  if (title) {
    Object.assign(next, { title });
  }

  assignUnlessCleared(
    next,
    patch.clearFilters,
    'filters',
    patch.filters ?? item.filters
  );

  const viewMode = patch.viewMode ?? item.viewMode;
  assignNonDefaultField(next, 'viewMode', viewMode, viewMode === 'chart');

  assignUnlessCleared(
    next,
    patch.clearFocusedSliceKey,
    'focusedSliceKey',
    patch.focusedSliceKey ?? resolveFocusedSliceKey(item)
  );

  const pieVariant = patch.pieVariant ?? item.pieVariant;
  assignUnlessCleared(
    next,
    patch.clearPieVariant,
    'pieVariant',
    pieVariant,
    pieVariant === 'donut'
  );

  const labelField = patch.labelField ?? item.labelField;
  assignUnlessCleared(
    next,
    patch.clearLabelField,
    'labelField',
    labelField,
    labelField === 'status'
  );

  const showValueAs = patch.showValueAs ?? item.showValueAs;
  assignUnlessCleared(
    next,
    patch.clearShowValueAs,
    'showValueAs',
    showValueAs,
    showValueAs === 'percent'
  );

  const sortSlicesBy = patch.sortSlicesBy ?? item.sortSlicesBy;
  assignUnlessCleared(
    next,
    patch.clearSortSlicesBy,
    'sortSlicesBy',
    sortSlicesBy,
    sortSlicesBy === 'value_desc'
  );

  const showEmptySlices = patch.showEmptySlices ?? item.showEmptySlices;
  assignUnlessCleared(
    next,
    patch.clearShowEmptySlices,
    'showEmptySlices',
    showEmptySlices,
    showEmptySlices === false || showEmptySlices == null
  );

  const visibleTableColumns =
    patch.visibleTableColumns ?? item.visibleTableColumns;
  assignUnlessCleared(
    next,
    patch.clearVisibleTableColumns,
    'visibleTableColumns',
    visibleTableColumns
  );

  assignUnlessCleared(
    next,
    patch.clearSliceColors,
    'sliceColors',
    patch.sliceColors ?? item.sliceColors
  );

  return next;
}

export function updateChartWidgetFilters(
  instanceId: string,
  filters: ChartBoardWidgetInstance['filters'] | null,
  instances: ChartBoardWidgetInstance[]
): ChartBoardWidgetInstance[] {
  return instances.map((item) => {
    if (item.instanceId !== instanceId) {
      return item;
    }
    if (!filters) {
      return withInstanceFields(item, { clearFilters: true });
    }
    return withInstanceFields(item, { filters });
  });
}

export function updateChartWidgetViewMode(
  instanceId: string,
  viewMode: ChartWidgetViewMode,
  focusedSliceKey: string | null | undefined,
  instances: ChartBoardWidgetInstance[]
): ChartBoardWidgetInstance[] {
  return instances.map((item) => {
    if (item.instanceId !== instanceId) {
      return item;
    }
    return withInstanceFields(item, {
      viewMode,
      focusedSliceKey: focusedSliceKey ?? undefined,
      clearFocusedSliceKey: focusedSliceKey == null,
    });
  });
}

export function updateChartWidgetPieVariant(
  instanceId: string,
  pieVariant: ChartPieVariant,
  instances: ChartBoardWidgetInstance[]
): ChartBoardWidgetInstance[] {
  return instances.map((item) => {
    if (item.instanceId !== instanceId) {
      return item;
    }
    if (pieVariant === 'donut') {
      return withInstanceFields(item, { clearPieVariant: true });
    }
    return withInstanceFields(item, { pieVariant });
  });
}

export function updateChartWidgetLabelField(
  instanceId: string,
  labelField: ChartsLabelFieldId,
  instances: ChartBoardWidgetInstance[]
): ChartBoardWidgetInstance[] {
  return instances.map((item) => {
    if (item.instanceId !== instanceId) {
      return item;
    }
    if (labelField === 'status') {
      return withInstanceFields(item, {
        clearLabelField: true,
        clearFocusedSliceKey: true,
        clearSliceColors: true,
      });
    }
    return withInstanceFields(item, {
      labelField,
      clearFocusedSliceKey: true,
      clearSliceColors: true,
    });
  });
}

export function updateChartWidgetDisplaySettings(
  instanceId: string,
  patch: ChartWidgetDisplaySettingsPatch,
  instances: ChartBoardWidgetInstance[]
): ChartBoardWidgetInstance[] {
  return instances.map((item) => {
    if (item.instanceId !== instanceId) {
      return item;
    }
    return withInstanceFields(item, displaySettingsPatch(patch));
  });
}

function displaySettingsPatch(
  patch: ChartWidgetDisplaySettingsPatch
): ChartInstanceFieldPatch {
  const next: ChartInstanceFieldPatch = {};
  applyShowValueAsPatch(patch, next);
  applySortSlicesByPatch(patch, next);
  applyShowEmptySlicesPatch(patch, next);
  applyVisibleTableColumnsPatch(patch, next);
  applySliceColorsPatch(patch, next);
  return next;
}

function applyShowValueAsPatch(
  patch: ChartWidgetDisplaySettingsPatch,
  next: ChartInstanceFieldPatch
): void {
  if (patch.showValueAs === undefined) {
    return;
  }
  if (patch.showValueAs === 'percent') {
    Object.assign(next, { clearShowValueAs: true });
    return;
  }
  Object.assign(next, { showValueAs: patch.showValueAs });
}

function applySortSlicesByPatch(
  patch: ChartWidgetDisplaySettingsPatch,
  next: ChartInstanceFieldPatch
): void {
  if (patch.sortSlicesBy === undefined) {
    return;
  }
  if (patch.sortSlicesBy === 'value_desc') {
    Object.assign(next, { clearSortSlicesBy: true });
    return;
  }
  Object.assign(next, { sortSlicesBy: patch.sortSlicesBy });
}

function applyShowEmptySlicesPatch(
  patch: ChartWidgetDisplaySettingsPatch,
  next: ChartInstanceFieldPatch
): void {
  if (patch.showEmptySlices === undefined) {
    return;
  }
  if (patch.showEmptySlices) {
    Object.assign(next, { showEmptySlices: true });
    return;
  }
  Object.assign(next, { clearShowEmptySlices: true });
}

function applyVisibleTableColumnsPatch(
  patch: ChartWidgetDisplaySettingsPatch,
  next: ChartInstanceFieldPatch
): void {
  if (patch.visibleTableColumns === undefined) {
    return;
  }
  Object.assign(next, {
    visibleTableColumns: patch.visibleTableColumns,
    clearVisibleTableColumns: false,
  });
}

function applySliceColorsPatch(
  patch: ChartWidgetDisplaySettingsPatch,
  next: ChartInstanceFieldPatch
): void {
  if (patch.sliceColors === undefined) {
    return;
  }
  if (
    patch.sliceColors == null ||
    Object.keys(patch.sliceColors).length === 0
  ) {
    Object.assign(next, { clearSliceColors: true });
    return;
  }
  Object.assign(next, {
    sliceColors: patch.sliceColors,
    clearSliceColors: false,
  });
}
