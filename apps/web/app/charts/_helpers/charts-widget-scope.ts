import type {
  ChartBoardWidgetInstance,
  ChartWidgetTypeId,
  ChartWorkspaceRecord,
  ChartWorkspaceScope,
} from '@/app/charts/_components/charts.types';
import type { ChartsWidgetFilterDraft } from '@/app/charts/_components/charts-sample.data';
import { isBurndownWidgetType } from '@/app/charts/_helpers/charts-burndown-widget';
import { isNestedDonutWidgetType } from '@/app/charts/_helpers/charts-nested-donut-widget';
import { CHARTS_DEFAULT_QUICK_SELECTIONS } from '@/app/charts/_helpers/charts-widget-defaults';
import { QUERY_FILTER_ALL_VALUE } from '@/hooks/use-query-filter';

/** Active board Filter selection (mixed workspaces). */
export type ChartsBoardFilterSelection = {
  readonly projectId: string;
  readonly sprintId: string | null;
};

export function isWorkspaceScoped(
  workspace: Pick<ChartWorkspaceRecord, 'scope'> | null | undefined
): boolean {
  return Boolean(workspace?.scope?.projectId && workspace?.scope?.sprintId);
}

/** Widget types that carry project/sprint filters (chart + nested + burndown). */
export function widgetTypeRequiresScope(typeId: ChartWidgetTypeId): boolean {
  return (
    typeId === 'chart' ||
    isNestedDonutWidgetType(typeId) ||
    isBurndownWidgetType(typeId)
  );
}

/** Burndown must pick a concrete sprint; chart may use All sprints. */
export function requiresSprintOnCreate(typeId: ChartWidgetTypeId): boolean {
  return isBurndownWidgetType(typeId);
}

export function boardFilterFromPreference(
  preference: {
    readonly projectId: string;
    readonly sprintId?: string | null;
  } | null
): ChartsBoardFilterSelection {
  if (!preference) {
    return { projectId: QUERY_FILTER_ALL_VALUE, sprintId: null };
  }
  return {
    projectId: preference.projectId || QUERY_FILTER_ALL_VALUE,
    sprintId: preference.sprintId?.trim() || null,
  };
}

/**
 * Build filters for a widget from a concrete project/sprint (or All).
 * Dimension filters start clean (`all` / empty advanced rows).
 */
export function buildScopedFilters(args: {
  readonly projectId: string;
  readonly sprintId?: string | null;
}): ChartsWidgetFilterDraft {
  const projectId = args.projectId.trim() || QUERY_FILTER_ALL_VALUE;
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

export function filtersFromWorkspaceScope(
  scope: ChartWorkspaceScope
): ChartsWidgetFilterDraft {
  return buildScopedFilters({
    projectId: scope.projectId,
    sprintId: scope.sprintId,
  });
}

export function filtersFromBoardSelection(
  selection: ChartsBoardFilterSelection
): ChartsWidgetFilterDraft {
  return buildScopedFilters({
    projectId: selection.projectId,
    sprintId: selection.sprintId,
  });
}

/**
 * Mixed burndown insert: need concrete project + sprint. When the active
 * Filter is missing either, prompt before insert.
 */
export function burndownInsertNeedsScopePrompt(
  selection: ChartsBoardFilterSelection
): boolean {
  const projectId = selection.projectId.trim();
  const sprintId = selection.sprintId?.trim() || '';
  return (
    !projectId ||
    projectId === QUERY_FILTER_ALL_VALUE ||
    !sprintId ||
    sprintId === QUERY_FILTER_ALL_VALUE
  );
}

export type ChartWidgetInsertAction =
  | { readonly type: 'append-plain' }
  | {
      readonly type: 'append-filters';
      readonly filters: ChartsWidgetFilterDraft;
    }
  | { readonly type: 'prompt-burndown' };

/**
 * Decide how to insert a Catalog widget given workspace scope vs board Filter.
 * Caller still checks availability before invoking.
 */
export function resolveChartWidgetInsertAction(args: {
  readonly typeId: ChartWidgetTypeId;
  readonly workspaceScope: ChartWorkspaceScope | null | undefined;
  readonly activeBoardFilter: ChartsBoardFilterSelection;
}): ChartWidgetInsertAction {
  const { typeId, workspaceScope, activeBoardFilter } = args;

  if (workspaceScope) {
    if (widgetTypeRequiresScope(typeId)) {
      return {
        type: 'append-filters',
        filters: filtersFromWorkspaceScope(workspaceScope),
      };
    }
    return { type: 'append-plain' };
  }

  if (!widgetTypeRequiresScope(typeId)) {
    return { type: 'append-plain' };
  }

  if (
    requiresSprintOnCreate(typeId) &&
    burndownInsertNeedsScopePrompt(activeBoardFilter)
  ) {
    return { type: 'prompt-burndown' };
  }

  return {
    type: 'append-filters',
    filters: filtersFromBoardSelection(activeBoardFilter),
  };
}

/**
 * When Clear all runs while project/sprint are workspace-locked, keep
 * project/sprint and reset dimension filters only.
 */
export function clearDimensionFiltersKeepingScope(
  filters: ChartsWidgetFilterDraft
): ChartsWidgetFilterDraft {
  return buildScopedFilters({
    projectId: filters.projectId,
    sprintId: filters.sprintId,
  });
}

/**
 * Strip legacy per-widget `scopeLocked` when marking a board non-scoped.
 */
export function clearInstanceScopeLocks(
  instances: ChartBoardWidgetInstance[]
): ChartBoardWidgetInstance[] {
  return instances.map((item) => {
    if (!item.scopeLocked) {
      return item;
    }
    const next: ChartBoardWidgetInstance = { ...item };
    delete (next as { scopeLocked?: boolean }).scopeLocked;
    return next;
  });
}
