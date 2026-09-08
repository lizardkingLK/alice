'use client';

import { useMemo } from 'react';
import ReactGridLayout, {
  type Layout,
  type LayoutItem,
} from 'react-grid-layout';
import { Button } from '@repo/ui/components/ui/button';
import { Skeleton } from '@repo/ui/components/ui/skeleton';
import { RotateCcw } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { ChartsWidgetCard } from '@/app/charts/_components/charts-widget-card';
import {
  DASHBOARD_DRAG_CONFIG,
  DASHBOARD_GRID_CONFIG,
  DASHBOARD_RESIZE_CONFIG,
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
  ChartWidgetTypeId,
} from '@/app/charts/_components/charts.types';
import 'react-grid-layout/css/styles.css';
import '@/app/dashboard/_components/dashboard-grid.css';

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

export function nextChartLayoutItem(
  instanceId: string,
  existing: LayoutItem[],
  typeId: ChartWidgetTypeId = 'chart'
): LayoutItem {
  const size = layoutSizeForWidgetType(typeId);
  const maxY = existing.reduce(
    (acc, item) => Math.max(acc, item.y + item.h),
    0
  );
  return {
    i: instanceId,
    x: 0,
    y: maxY,
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
  readonly onClearBoard: () => void;
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
  onClearBoard,
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
    <div className={cn('flex min-h-0 flex-1 flex-col gap-3', className)}>
      {!isEmpty ? (
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Hold the grip to drag widgets. Resize from the bottom-right corner.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={onClearBoard}
          >
            <RotateCcw className="size-3.5" />
            Clear board
          </Button>
        </div>
      ) : null}

      <div
        ref={containerRef}
        className={cn(
          'dashboard-grid min-h-0 w-full flex-1 transition-opacity duration-150',
          isEmpty && 'flex min-h-0',
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
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2">
        <Skeleton className="h-4 w-72 max-w-full" />
        <Skeleton className="h-8 w-28" />
      </div>
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
}>) {
  if (isEmpty) {
    return (
      <div className="border-border text-muted-foreground flex min-h-0 flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-6 py-12 text-center text-sm">
        <p>No widgets yet. Use Add Widget to place charts on this board.</p>
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
      className="layout"
      width={stableWidth}
      layout={layout}
      gridConfig={DASHBOARD_GRID_CONFIG}
      dragConfig={DASHBOARD_DRAG_CONFIG}
      resizeConfig={DASHBOARD_RESIZE_CONFIG}
      onLayoutChange={onLayoutChange}
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
              onRemove={() => onRemoveWidget(item.i)}
              onDuplicate={() => onDuplicateWidget(item.i)}
              onRename={(nextTitle) => onRenameWidget(item.i, nextTitle)}
              onFiltersChange={(nextFilters) =>
                onFiltersChange(item.i, nextFilters)
              }
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
  title?: string
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
    nextChartLayoutItem(instanceId, layout, typeId),
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
  const baseTitle = source.title?.trim() || catalogTitle || 'Widget';
  const next = appendChartWidget(
    source.typeId,
    instances,
    layout,
    `${baseTitle} (copy)`
  );
  if (!source.filters) {
    return next;
  }
  const copiedId = next.instances.at(-1)?.instanceId;
  if (!copiedId) {
    return next;
  }
  return {
    ...next,
    instances: updateChartWidgetFilters(
      copiedId,
      source.filters,
      next.instances
    ),
  };
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
      return {
        instanceId: item.instanceId,
        typeId: item.typeId,
        ...(item.title ? { title: item.title } : {}),
      };
    }
    return { ...item, filters };
  });
}
