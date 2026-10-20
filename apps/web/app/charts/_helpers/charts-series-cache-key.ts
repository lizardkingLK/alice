import type { ChartSeriesResponse } from '@repo/types';
import {
  chartAnalyticsDimensionCacheKey,
  type ChartAnalyticsDimensionFilters,
} from '@/app/charts/_helpers/charts-analytics.ui';

export type PrefetchedChartSeriesEntry = {
  readonly cacheKey: string;
  readonly series: ChartSeriesResponse;
};

/** Same key shape for client Map cache and RSC prefetch. */
export function chartSeriesCacheKey(params: {
  readonly projectId: string | null;
  readonly labelField: string;
  readonly sprintId?: string;
  readonly dimensionFilters?: ChartAnalyticsDimensionFilters;
}): string {
  return [
    params.projectId ?? 'all',
    params.labelField,
    params.sprintId ?? '',
    chartAnalyticsDimensionCacheKey(params.dimensionFilters),
  ].join('::');
}
