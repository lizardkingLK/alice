'use client';

import type {
  ChartHierarchyDrilldownResponse,
  ChartHierarchyMeasure,
  ChartHierarchySeriesQuery,
  ChartHierarchySeriesResponse,
} from '@repo/types';
import {
  chartAnalyticsDimensionCacheKey,
  chartAnalyticsDimensionQueryFields,
  type ChartAnalyticsDimensionFilters,
} from '@/app/charts/_helpers/charts-analytics.ui';
import { parseHierarchyFocus } from '@/app/charts/_helpers/charts-hierarchy-focus';
import {
  fetchChartHierarchyDrilldown,
  fetchChartHierarchySeries,
} from '@/app/charts/_services/charts.analytics.client';
import {
  registerChartAnalyticsCache,
  useCachedAnalyticsResource,
  useChartAnalyticsInvalidateEpoch,
} from '@/app/charts/_hooks/chart-widget-analytics-cache';

type UseChartWidgetHierarchyAnalyticsParams = {
  readonly projectId: string | null | undefined;
  readonly measure: ChartHierarchyMeasure;
  /** Dig root work-item id (disk-analyzer zoom). */
  readonly rootWorkItemId?: string;
  readonly sprintId?: string;
  readonly dimensionFilters?: ChartAnalyticsDimensionFilters;
  readonly focusedSliceKey?: string | null;
  readonly loadDrilldown?: boolean;
  readonly drilldownPage?: number;
  readonly drilldownLimit?: number;
};

type HierarchyAnalyticsState = {
  readonly series: ChartHierarchySeriesResponse | null;
  readonly drilldown: ChartHierarchyDrilldownResponse | null;
  readonly seriesLoading: boolean;
  readonly drilldownLoading: boolean;
  readonly seriesError: string | null;
  readonly drilldownError: string | null;
};

const seriesCache = new Map<string, ChartHierarchySeriesResponse>();
const drilldownCache = new Map<string, ChartHierarchyDrilldownResponse>();
registerChartAnalyticsCache(seriesCache);
registerChartAnalyticsCache(drilldownCache);

function hierarchySeriesKey(params: {
  projectId: string | null;
  measure: ChartHierarchyMeasure;
  rootWorkItemId?: string;
  sprintId?: string;
  dimensionFilters?: ChartAnalyticsDimensionFilters;
}): string {
  return [
    params.projectId ?? 'all',
    params.measure,
    params.rootWorkItemId ?? '',
    params.sprintId ?? '',
    chartAnalyticsDimensionCacheKey(params.dimensionFilters),
  ].join('::');
}

function toHierarchySeriesQuery(params: {
  projectId: string | null;
  measure: ChartHierarchyMeasure;
  rootWorkItemId?: string;
  sprintId?: string;
  dimensionFilters?: ChartAnalyticsDimensionFilters;
}): ChartHierarchySeriesQuery {
  return {
    ...(params.projectId ? { projectId: params.projectId } : {}),
    measure: params.measure,
    ...(params.rootWorkItemId
      ? { rootWorkItemId: params.rootWorkItemId }
      : {}),
    ...(params.sprintId ? { sprintId: params.sprintId } : {}),
    ...chartAnalyticsDimensionQueryFields(params.dimensionFilters),
  };
}

/**
 * Client fetch for Nested donut hierarchy series + optional slice drilldown.
 * Clears module caches on chart analytics invalidate.
 */
export function useChartWidgetHierarchyAnalytics(
  params: UseChartWidgetHierarchyAnalyticsParams
): HierarchyAnalyticsState {
  const {
    projectId,
    measure,
    rootWorkItemId,
    sprintId,
    dimensionFilters,
    focusedSliceKey,
    loadDrilldown = false,
    drilldownPage = 1,
    drilldownLimit = 20,
  } = params;

  const epoch = useChartAnalyticsInvalidateEpoch();
  const seriesEnabled = projectId !== undefined;
  const drilldownEnabled = seriesEnabled && loadDrilldown;
  const focus = parseHierarchyFocus(focusedSliceKey);

  const seriesKey = seriesEnabled
    ? hierarchySeriesKey({
        projectId,
        measure,
        rootWorkItemId,
        sprintId,
        dimensionFilters,
      })
    : 'disabled';
  const drillKey = drilldownEnabled
    ? [
        seriesKey,
        focusedSliceKey ?? '',
        String(drilldownPage),
        String(drilldownLimit),
      ].join('::')
    : 'disabled';

  const series = useCachedAnalyticsResource({
    enabled: seriesEnabled,
    cache: seriesCache,
    cacheKey: seriesKey,
    epoch,
    fetcher: () => {
      if (projectId === undefined) {
        return Promise.reject(new Error('Hierarchy series fetch disabled'));
      }
      return fetchChartHierarchySeries(
        toHierarchySeriesQuery({
          projectId,
          measure,
          rootWorkItemId,
          sprintId,
          dimensionFilters,
        })
      );
    },
    fallbackError: 'Failed to load series',
  });

  const drilldown = useCachedAnalyticsResource({
    enabled: drilldownEnabled,
    cache: drilldownCache,
    cacheKey: drillKey,
    epoch,
    fetcher: () => {
      if (projectId === undefined) {
        return Promise.reject(new Error('Hierarchy drilldown fetch disabled'));
      }
      return fetchChartHierarchyDrilldown({
        ...toHierarchySeriesQuery({
          projectId,
          measure,
          rootWorkItemId,
          sprintId,
          dimensionFilters,
        }),
        page: drilldownPage,
        limit: drilldownLimit,
        ...(focus?.ring !== undefined ? { ring: focus.ring } : {}),
        ...(focus?.sliceKey ? { sliceKey: focus.sliceKey } : {}),
        ...(focus?.parentKey ? { parentKey: focus.parentKey } : {}),
      });
    },
    fallbackError: 'Failed to load drilldown',
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
