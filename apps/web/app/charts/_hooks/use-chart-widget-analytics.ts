'use client';

import type {
  ChartDrilldownQuery,
  ChartDrilldownResponse,
  ChartSeriesLabelField,
  ChartSeriesQuery,
  ChartSeriesResponse,
} from '@repo/types';
import {
  fetchChartDrilldown,
  fetchChartSeries,
} from '@/app/charts/_services/charts.analytics.client';
import {
  chartAnalyticsDimensionQueryFields,
  type ChartAnalyticsDimensionFilters,
} from '@/app/charts/_helpers/charts-analytics.ui';
import { chartSeriesCacheKey } from '@/app/charts/_helpers/charts-series-cache-key';
import {
  registerChartAnalyticsCache,
  useCachedAnalyticsResource,
  useChartAnalyticsInvalidateEpoch,
} from '@/app/charts/_hooks/chart-widget-analytics-cache';

export {
  CHART_ANALYTICS_INVALIDATE_EVENT,
  invalidateChartAnalyticsCaches,
} from '@/app/charts/_hooks/chart-widget-analytics-cache';
export { chartSeriesCacheKey };

type UseChartWidgetAnalyticsParams = {
  /**
   * Concrete project UUID, or `null` for all accessible projects.
   * Pass `undefined` to skip fetching (non-chart widgets).
   */
  readonly projectId: string | null | undefined;
  readonly labelField: ChartSeriesLabelField | null;
  readonly sprintId?: string;
  readonly dimensionFilters?: ChartAnalyticsDimensionFilters;
  /** When set, also load drilldown for table / split. */
  readonly focusedSliceKey?: string | null;
  /**
   * Load drilldown. When `focusedSliceKey` is null/undefined and this is true,
   * fetches unscoped rows (all status groups for table layout).
   */
  readonly loadDrilldown?: boolean;
  readonly drilldownPage?: number;
  readonly drilldownLimit?: number;
};

type ChartWidgetAnalyticsState = {
  readonly series: ChartSeriesResponse | null;
  readonly drilldown: ChartDrilldownResponse | null;
  readonly seriesLoading: boolean;
  readonly drilldownLoading: boolean;
  readonly seriesError: string | null;
  readonly drilldownError: string | null;
};

const seriesCache = new Map<string, ChartSeriesResponse>();
const drilldownCache = new Map<string, ChartDrilldownResponse>();
registerChartAnalyticsCache(seriesCache);
registerChartAnalyticsCache(drilldownCache);

/** Seed series responses from RSC prefetch before widget hooks mount. */
export function seedChartSeriesCache(
  entries: readonly {
    readonly cacheKey: string;
    readonly series: ChartSeriesResponse;
  }[]
): void {
  for (const entry of entries) {
    if (!seriesCache.has(entry.cacheKey)) {
      seriesCache.set(entry.cacheKey, entry.series);
    }
  }
}

function drilldownCacheKey(params: {
  projectId: string | null;
  labelField: string;
  sprintId?: string;
  dimensionFilters?: ChartAnalyticsDimensionFilters;
  sliceKey: string | undefined;
  page: number;
  limit: number;
}): string {
  return [
    chartSeriesCacheKey(params),
    params.sliceKey ?? '*',
    String(params.page),
    String(params.limit),
  ].join('::');
}

function toSeriesQuery(params: {
  projectId: string | null;
  labelField: ChartSeriesLabelField;
  sprintId?: string;
  dimensionFilters?: ChartAnalyticsDimensionFilters;
}): ChartSeriesQuery {
  return {
    ...(params.projectId ? { projectId: params.projectId } : {}),
    labelField: params.labelField,
    ...(params.sprintId ? { sprintId: params.sprintId } : {}),
    ...chartAnalyticsDimensionQueryFields(params.dimensionFilters),
  };
}

function toDrilldownQuery(params: {
  projectId: string | null;
  labelField: ChartSeriesLabelField;
  sprintId?: string;
  dimensionFilters?: ChartAnalyticsDimensionFilters;
  sliceKey: string | undefined;
  page: number;
  limit: number;
}): ChartDrilldownQuery {
  return {
    ...toSeriesQuery(params),
    ...(params.sliceKey !== undefined ? { sliceKey: params.sliceKey } : {}),
    page: params.page,
    limit: params.limit,
  };
}

/**
 * Client fetch for Chart widget pie series + optional slice drilldown.
 * `projectId === null` means All projects (omit query param).
 * Responses are cached in-memory for the session (slice re-clicks reuse cache).
 * Call {@link invalidateChartAnalyticsCaches} after mutating work items so open
 * widgets refetch (event + cleared maps).
 */
export function useChartWidgetAnalytics(
  params: UseChartWidgetAnalyticsParams & {
    /** Increment after cache invalidation to force refetch. */
    readonly cacheEpoch?: number;
  }
): ChartWidgetAnalyticsState {
  const {
    projectId,
    labelField,
    sprintId,
    dimensionFilters,
    focusedSliceKey = null,
    loadDrilldown = false,
    drilldownPage = 1,
    drilldownLimit = 50,
    cacheEpoch = 0,
  } = params;

  const epoch = useChartAnalyticsInvalidateEpoch(cacheEpoch);
  const seriesEnabled = projectId !== undefined && labelField != null;
  const drilldownEnabled = seriesEnabled && loadDrilldown;
  const sliceKey = focusedSliceKey ?? undefined;

  const seriesKey = seriesEnabled
    ? chartSeriesCacheKey({
        projectId,
        labelField,
        sprintId,
        dimensionFilters,
      })
    : 'disabled';
  const drillKey = drilldownEnabled
    ? drilldownCacheKey({
        projectId,
        labelField,
        sprintId,
        dimensionFilters,
        sliceKey,
        page: drilldownPage,
        limit: drilldownLimit,
      })
    : 'disabled';

  const series = useCachedAnalyticsResource({
    enabled: seriesEnabled,
    cache: seriesCache,
    cacheKey: seriesKey,
    epoch,
    fetcher: () => {
      if (projectId === undefined || labelField == null) {
        return Promise.reject(new Error('Series fetch disabled'));
      }
      return fetchChartSeries(
        toSeriesQuery({
          projectId,
          labelField,
          sprintId,
          dimensionFilters,
        })
      );
    },
    fallbackError: 'Failed to load chart series',
  });

  const drilldown = useCachedAnalyticsResource({
    enabled: drilldownEnabled,
    cache: drilldownCache,
    cacheKey: drillKey,
    epoch,
    fetcher: () => {
      if (projectId === undefined || labelField == null) {
        return Promise.reject(new Error('Drilldown fetch disabled'));
      }
      return fetchChartDrilldown(
        toDrilldownQuery({
          projectId,
          labelField,
          sprintId,
          dimensionFilters,
          sliceKey,
          page: drilldownPage,
          limit: drilldownLimit,
        })
      );
    },
    fallbackError: 'Failed to load chart drilldown',
    /** Keep table rows when switching Chart-only; clear when widget idle. */
    keepPreviousOnDisable: seriesEnabled,
  });

  return {
    series: series.data,
    drilldown: drilldown.data,
    seriesLoading: series.loading,
    drilldownLoading: drilldown.loading,
    seriesError: series.error,
    drilldownError: drilldown.error,
  };
}
