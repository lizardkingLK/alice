import type { LayoutItem } from 'react-grid-layout';
import { DASHBOARD_GRID_CONFIG } from '@/lib/dashboard-grid';
import type {
  ChartBoardWidgetInstance,
  ChartWidgetTypeId,
} from '@/app/charts/_components/charts.types';
import { isBurndownWidgetType } from '@/app/charts/_helpers/charts-burndown-widget';

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
  if (typeId === 'chart' || isBurndownWidgetType(typeId)) {
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

export function chartLayoutsEqual(
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
