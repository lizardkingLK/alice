'use client';

import { useEffect, useState } from 'react';
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
import type { ChartAnalyticsDimensionFilters } from '@/app/charts/_helpers/charts-analytics.ui';
import { isSessionExpiredError } from '@/lib/errors/session-expired';

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

const EMPTY: ChartWidgetAnalyticsState = {
  series: null,
  drilldown: null,
  seriesLoading: false,
  drilldownLoading: false,
  seriesError: null,
  drilldownError: null,
};

const seriesCache = new Map<string, ChartSeriesResponse>();
const drilldownCache = new Map<string, ChartDrilldownResponse>();

/** Fired after {@link invalidateChartAnalyticsCaches} so open hooks refetch. */
export const CHART_ANALYTICS_INVALIDATE_EVENT =
  'alice:chart-analytics-invalidate';

export function invalidateChartAnalyticsCaches(): void {
  seriesCache.clear();
  drilldownCache.clear();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CHART_ANALYTICS_INVALIDATE_EVENT));
  }
}

function dimensionCacheKey(
  filters: ChartAnalyticsDimensionFilters | undefined
): string {
  if (!filters) {
    return '';
  }
  return [
    filters.status ?? '',
    filters.type ?? '',
    filters.priority ?? '',
    filters.assigneeId ?? '',
  ].join('|');
}

function seriesCacheKey(params: {
  projectId: string | null;
  labelField: string;
  sprintId?: string;
  dimensionFilters?: ChartAnalyticsDimensionFilters;
}): string {
  return [
    params.projectId ?? 'all',
    params.labelField,
    params.sprintId ?? '',
    dimensionCacheKey(params.dimensionFilters),
  ].join('::');
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
    seriesCacheKey(params),
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
  const filters = params.dimensionFilters;
  return {
    ...(params.projectId ? { projectId: params.projectId } : {}),
    labelField: params.labelField,
    ...(params.sprintId ? { sprintId: params.sprintId } : {}),
    ...(filters?.status ? { status: filters.status } : {}),
    ...(filters?.type ? { type: filters.type } : {}),
    ...(filters?.priority ? { priority: filters.priority } : {}),
    ...(filters?.assigneeId !== undefined
      ? { assigneeId: filters.assigneeId }
      : {}),
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

  const [state, setState] = useState<ChartWidgetAnalyticsState>(EMPTY);
  const [invalidateEpoch, setInvalidateEpoch] = useState(0);
  const enabled = projectId !== undefined && Boolean(labelField);
  const dimKey = dimensionCacheKey(dimensionFilters);
  const epoch = cacheEpoch + invalidateEpoch;

  useEffect(() => {
    const onInvalidate = () => {
      setInvalidateEpoch((value) => value + 1);
    };
    window.addEventListener(CHART_ANALYTICS_INVALIDATE_EVENT, onInvalidate);
    return () => {
      window.removeEventListener(
        CHART_ANALYTICS_INVALIDATE_EVENT,
        onInvalidate
      );
    };
  }, []);

  useEffect(() => {
    if (!enabled || !labelField || projectId === undefined) {
      setState(EMPTY);
      return;
    }

    const key = seriesCacheKey({
      projectId,
      labelField,
      sprintId,
      dimensionFilters,
    });
    const cached = seriesCache.get(key);
    if (cached) {
      setState((prev) => ({
        ...prev,
        series: cached,
        seriesLoading: false,
        seriesError: null,
      }));
      return;
    }

    let cancelled = false;
    setState((prev) => ({
      ...prev,
      seriesLoading: true,
      seriesError: null,
    }));

    fetchChartSeries(
      toSeriesQuery({
        projectId,
        labelField,
        sprintId,
        dimensionFilters,
      })
    )
      .then((series) => {
        seriesCache.set(key, series);
        if (cancelled) {
          return;
        }
        setState((prev) => ({
          ...prev,
          series,
          seriesLoading: false,
          seriesError: null,
        }));
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        // Session expiry opens the shared dialog via apiFetch; skip inline error.
        if (isSessionExpiredError(error)) {
          setState((prev) => ({
            ...prev,
            seriesLoading: false,
          }));
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load chart series';
        setState((prev) => ({
          ...prev,
          series: null,
          seriesLoading: false,
          seriesError: message,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [
    epoch,
    dimKey,
    dimensionFilters,
    enabled,
    labelField,
    projectId,
    sprintId,
  ]);

  useEffect(() => {
    if (!enabled || !labelField || projectId === undefined || !loadDrilldown) {
      setState((prev) => ({
        ...prev,
        drilldownLoading: false,
        drilldownError: null,
        // Keep last drilldown so closing the dialog does not flash an empty table.
      }));
      return;
    }

    const sliceKey = focusedSliceKey ?? undefined;

    const key = drilldownCacheKey({
      projectId,
      labelField,
      sprintId,
      dimensionFilters,
      sliceKey,
      page: drilldownPage,
      limit: drilldownLimit,
    });
    const cached = drilldownCache.get(key);
    if (cached) {
      setState((prev) => ({
        ...prev,
        drilldown: cached,
        drilldownLoading: false,
        drilldownError: null,
      }));
      return;
    }

    let cancelled = false;
    setState((prev) => ({
      ...prev,
      drilldownLoading: true,
      drilldownError: null,
    }));

    fetchChartDrilldown(
      toDrilldownQuery({
        projectId,
        labelField,
        sprintId,
        dimensionFilters,
        sliceKey,
        page: drilldownPage,
        limit: drilldownLimit,
      })
    )
      .then((drilldown) => {
        drilldownCache.set(key, drilldown);
        if (cancelled) {
          return;
        }
        setState((prev) => ({
          ...prev,
          drilldown,
          drilldownLoading: false,
          drilldownError: null,
        }));
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        if (isSessionExpiredError(error)) {
          setState((prev) => ({
            ...prev,
            drilldownLoading: false,
          }));
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : 'Failed to load chart drilldown';
        setState((prev) => ({
          ...prev,
          drilldown: null,
          drilldownLoading: false,
          drilldownError: message,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [
    epoch,
    dimKey,
    dimensionFilters,
    drilldownLimit,
    drilldownPage,
    enabled,
    focusedSliceKey,
    labelField,
    loadDrilldown,
    projectId,
    sprintId,
  ]);

  return state;
}
