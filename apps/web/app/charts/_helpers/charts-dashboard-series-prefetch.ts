import {
  DEFAULT_CHARTS_LABEL_FIELD,
  type ChartsLabelFieldId,
  type ChartsWidgetFilterDraft,
} from '@/app/charts/_components/charts-sample.data';
import type { ChartWorkspaceRecord } from '@/app/charts/_components/charts.types';
import {
  chartAnalyticsDimensionQueryFields,
  isChartSeriesLabelField,
  resolveChartAnalyticsDimensionFilters,
  resolveChartAnalyticsProjectId,
  resolveChartAnalyticsSprintId,
} from '@/app/charts/_helpers/charts-analytics.ui';
import {
  chartSeriesCacheKey,
  type PrefetchedChartSeriesEntry,
} from '@/app/charts/_helpers/charts-series-cache-key';
import { fetchChartSeriesServer } from '@/app/charts/_services/charts.analytics.server';

export type { PrefetchedChartSeriesEntry };

function buildSeriesRequest(instance: {
  readonly typeId: string;
  readonly labelField?: ChartsLabelFieldId;
  readonly filters?: ChartsWidgetFilterDraft;
}): {
  cacheKey: string;
  query: Parameters<typeof fetchChartSeriesServer>[0];
} | null {
  if (instance.typeId !== 'chart') {
    return null;
  }
  const labelFieldRaw: ChartsLabelFieldId =
    instance.labelField ?? DEFAULT_CHARTS_LABEL_FIELD;
  if (!isChartSeriesLabelField(labelFieldRaw)) {
    return null;
  }
  const filters = instance.filters ?? null;
  const projectId = resolveChartAnalyticsProjectId(filters);
  const sprintId = resolveChartAnalyticsSprintId(filters);
  const dimensionFilters = resolveChartAnalyticsDimensionFilters(filters);
  const cacheKey = chartSeriesCacheKey({
    projectId,
    labelField: labelFieldRaw,
    ...(sprintId ? { sprintId } : {}),
    dimensionFilters,
  });
  return {
    cacheKey,
    query: {
      ...(projectId ? { projectId } : {}),
      labelField: labelFieldRaw,
      ...(sprintId ? { sprintId } : {}),
      ...chartAnalyticsDimensionQueryFields(dimensionFilters),
    },
  };
}

/**
 * Prefetch flat pie series for a dashboard slide's Chart widgets (parallel).
 * Nested-donut / burndown stay client-fetched.
 */
export async function prefetchDashboardSlideChartSeries(
  slide: ChartWorkspaceRecord | null | undefined
): Promise<readonly PrefetchedChartSeriesEntry[]> {
  if (!slide?.instances.length) {
    return [];
  }

  const requests = slide.instances
    .map((instance) => buildSeriesRequest(instance))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  if (requests.length === 0) {
    return [];
  }

  const uniqueByKey = new Map<string, (typeof requests)[number]>();
  for (const request of requests) {
    if (!uniqueByKey.has(request.cacheKey)) {
      uniqueByKey.set(request.cacheKey, request);
    }
  }

  const settled = await Promise.all(
    [...uniqueByKey.values()].map(async (request) => {
      try {
        const series = await fetchChartSeriesServer(request.query);
        return { cacheKey: request.cacheKey, series } as const;
      } catch (error) {
        console.error(
          'error. failed to prefetch dashboard chart series:',
          error instanceof Error ? error.message : error
        );
        return null;
      }
    })
  );

  return settled.filter(
    (entry): entry is PrefetchedChartSeriesEntry => entry !== null
  );
}
