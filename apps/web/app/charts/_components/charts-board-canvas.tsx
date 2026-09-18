'use client';

import { useMemo } from 'react';
import ReactGridLayout, {
  type Layout,
  type LayoutItem,
} from 'react-grid-layout';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { cn } from '@repo/ui/lib/utils';
import { ChartsWidgetCard } from '@/app/charts/_components/charts-widget-card';
import {
  DASHBOARD_DRAG_CONFIG,
  DASHBOARD_GRID_CONFIG,
  DASHBOARD_RESIZE_CONFIG,
  useCancelGridDragOnEscape,
  useStableDashboardGridWidth,
} from '@/lib/dashboard-grid';
import {
  getLocalStorageJson,
  removeLocalStorageItem,
  setLocalStorageJson,
} from '@/lib/local-storage';
import {
  chartWidgetById,
  type ChartWidgetDefinition,
} from '@/app/charts/_components/charts-widget-catalog';
import type {
  ChartBoardWidgetInstance,
  ChartPieVariant,
  ChartsLabelFieldId,
  ChartWidgetTypeId,
  ChartWidgetViewMode,
} from '@/app/charts/_components/charts.types';
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

const LAYOUT_STORAGE_KEY = 'alice.charts.board.layout.v1';
const INSTANCES_STORAGE_KEY = 'alice.charts.board.instances.v1';

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

export function readStoredChartBoard(): {
  instances: ChartBoardWidgetInstance[];
  layout: LayoutItem[];
} {
  const instances =
    getLocalStorageJson<ChartBoardWidgetInstance[]>(INSTANCES_STORAGE_KEY) ??
    [];
  const layout = getLocalStorageJson<LayoutItem[]>(LAYOUT_STORAGE_KEY) ?? [];
  if (!Array.isArray(instances) || !Array.isArray(layout)) {
    return { instances: [], layout: [] };
  }

  const instanceIds = new Set(instances.map((item) => item.instanceId));
  const layoutById = new Map(
    layout
      .filter((item) => typeof item.i === 'string' && instanceIds.has(item.i))
      .map((item) => [item.i, item])
  );

  const syncedLayout = instances.map((instance, index) => {
    const size = layoutSizeForWidgetType(instance.typeId);
    const stored = layoutById.get(instance.instanceId);
    if (stored) {
      return {
        ...stored,
        minW: size.minW,
        minH: size.minH,
      };
    }
    return nextChartLayoutItem(
      instance.instanceId,
      syncedLayoutSlice(instances, layoutById, index),
      instance.typeId
    );
  });

  return { instances, layout: syncedLayout };
}

function syncedLayoutSlice(
  instances: ChartBoardWidgetInstance[],
  layoutById: Map<string, LayoutItem>,
  untilIndex: number
): LayoutItem[] {
  const items: LayoutItem[] = [];
  for (let i = 0; i < untilIndex; i += 1) {
    const instance = instances[i];
    if (!instance) {
      continue;
    }
    const stored = layoutById.get(instance.instanceId);
    if (stored) {
      items.push(stored);
    } else {
      items.push(
        nextChartLayoutItem(instance.instanceId, items, instance.typeId)
      );
    }
  }
  return items;
}

export function persistChartBoard(
  instances: ChartBoardWidgetInstance[],
  layout: LayoutItem[]
): void {
  setLocalStorageJson(INSTANCES_STORAGE_KEY, instances);
  setLocalStorageJson(LAYOUT_STORAGE_KEY, layout);
}

export function clearPersistedChartBoard(): void {
  removeLocalStorageItem(LAYOUT_STORAGE_KEY);
  removeLocalStorageItem(INSTANCES_STORAGE_KEY);
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
  readonly focusWidgetId?: string;
  readonly onFocusWidgetDismiss?: () => void;
  /** Accessible projects for Chart widget filters / series. */
  readonly accessibleProjects?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
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
  focusWidgetId,
  onFocusWidgetDismiss,
  accessibleProjects = [],
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

  const handleLayoutChange = (next: Layout) => {
    onLayoutChange([...next]);
  };

  if (!hydrated) {
    return <ChartsBoardCanvasSkeleton className={className} />;
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
          layout={layout}
          instanceById={instanceById}
          onLayoutChange={handleLayoutChange}
          onRemoveWidget={onRemoveWidget}
          onDuplicateWidget={onDuplicateWidget}
          onRenameWidget={onRenameWidget}
          onFiltersChange={onFiltersChange}
          onViewModeChange={onViewModeChange}
          onPieVariantChange={onPieVariantChange}
          onLabelFieldChange={onLabelFieldChange}
          focusWidgetId={focusWidgetId}
          onFocusWidgetDismiss={onFocusWidgetDismiss}
          accessibleProjects={accessibleProjects}
        />
      </div>
    </div>
  );
}

function ChartsBoardCanvasSkeleton({
  className,
}: Readonly<{ className?: string }>) {
  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col gap-3', className)}
      aria-busy="true"
      aria-label="Loading chart board"
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Skeleton className="min-h-56 rounded-xl" />
        <Skeleton className="min-h-56 rounded-xl" />
        <Skeleton className="min-h-56 rounded-xl sm:col-span-2 xl:col-span-1" />
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
  focusWidgetId,
  onFocusWidgetDismiss,
  accessibleProjects = [],
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
  focusWidgetId?: string;
  onFocusWidgetDismiss?: () => void;
  accessibleProjects?: ReadonlyArray<{
    readonly id: string;
    readonly name: string;
  }>;
}>) {
  const { dragSessionKey, onDragStart, onDragStop } =
    useCancelGridDragOnEscape(onLayoutChange);

  if (isEmpty) {
    return (
      <div className="border-border text-muted-foreground flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center text-sm">
        <p>No widgets yet. Use + to add a widget to this workspace.</p>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="bg-muted/20 h-full min-h-64 animate-pulse rounded-xl" />
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
              focusedSliceKey={resolveFocusedSliceKey(entry?.instance ?? {})}
              accessibleProjects={accessibleProjects}
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
  title?: string,
  sizeOverride?: Partial<Pick<LayoutItem, 'w' | 'h' | 'minW' | 'minH'>>
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
      ...(title ? { title } : {}),
    },
  ];
  const nextLayout = [
    ...layout,
    nextChartLayoutItem(instanceId, layout, typeId, sizeOverride),
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

  const next = appendChartWidget(
    source.typeId,
    instances,
    layout,
    `${baseTitle} (copy)`,
    sizeOverride
  );
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
  >
> & {
  readonly clearFilters?: boolean;
  readonly clearFocusedSliceKey?: boolean;
  readonly clearPieVariant?: boolean;
  readonly clearLabelField?: boolean;
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
      });
    }
    return withInstanceFields(item, {
      labelField,
      clearFocusedSliceKey: true,
    });
  });
}
