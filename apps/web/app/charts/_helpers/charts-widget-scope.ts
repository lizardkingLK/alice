import type {
  ChartBoardWidgetInstance,
  ChartWidgetTypeId,
} from '@/app/charts/_components/charts.types';
import type { ChartsWidgetFilterDraft } from '@/app/charts/_components/charts-sample.data';
import { isBurndownWidgetType } from '@/app/charts/_helpers/charts-burndown-widget';
import { CHARTS_DEFAULT_QUICK_SELECTIONS } from '@/app/charts/_helpers/charts-widget-defaults';

export function isWidgetScopeLocked(
  instance: Pick<ChartBoardWidgetInstance, 'scopeLocked'> | null | undefined
): boolean {
  return Boolean(instance?.scopeLocked);
}

/** Widget types that require create-time project (+ sprint rules below). */
export function widgetTypeRequiresScope(typeId: ChartWidgetTypeId): boolean {
  return typeId === 'chart' || isBurndownWidgetType(typeId);
}

/** Burndown must pick a concrete sprint; chart may use All sprints. */
export function requiresSprintOnCreate(typeId: ChartWidgetTypeId): boolean {
  return isBurndownWidgetType(typeId);
}

/**
 * Build filters for a locked (or about-to-lock) widget scope.
 * Dimension filters start clean (`all` / empty advanced rows).
 */
export function buildScopedFilters(args: {
  readonly projectId: string;
  readonly sprintId?: string | null;
}): ChartsWidgetFilterDraft {
  const projectId = args.projectId.trim();
  const sprintId = args.sprintId?.trim() || undefined;

  return {
    mode: 'quick',
    projectId,
    rows: [],
    quickSelections: {
      ...CHARTS_DEFAULT_QUICK_SELECTIONS,
      project: projectId,
      sprint: sprintId ?? 'all',
    },
    ...(sprintId ? { sprintId } : {}),
  };
}

/**
 * Apply a new locked scope: rewrite project/sprint, drop dimension filters,
 * clear focused slice. Keeps `scopeLocked: true` and display settings.
 */
export function updateChartWidgetScope(
  instanceId: string,
  scope: {
    readonly projectId: string;
    readonly sprintId?: string | null;
  },
  instances: ChartBoardWidgetInstance[]
): ChartBoardWidgetInstance[] {
  const filters = buildScopedFilters(scope);
  return instances.map((item) => {
    if (item.instanceId !== instanceId) {
      return item;
    }
    const next: ChartBoardWidgetInstance = {
      ...item,
      filters,
      scopeLocked: true,
    };
    delete (next as { focusedSliceKey?: string }).focusedSliceKey;
    return next;
  });
}

/**
 * When Clear all runs on a locked widget, keep project/sprint and reset
 * dimension filters only.
 */
export function clearDimensionFiltersKeepingScope(
  filters: ChartsWidgetFilterDraft
): ChartsWidgetFilterDraft {
  return buildScopedFilters({
    projectId: filters.projectId,
    sprintId: filters.sprintId,
  });
}
