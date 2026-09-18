'use client';

import { useEffect, useState } from 'react';
import type {
  ChartDrilldownResponse,
  ChartSeriesLabelField,
  ChartSeriesResponse,
} from '@repo/types';
import {
  fetchChartDrilldown,
  fetchChartSeries,
} from '@/app/charts/_services/charts.analytics.client';

type UseChartWidgetAnalyticsParams = {
  readonly projectId: string | null;
  readonly labelField: ChartSeriesLabelField | null;
  /** When set, also load drilldown for table / split. */
  readonly focusedSliceKey?: string | null;
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

/**
 * Client fetch for Chart widget pie series + optional slice drilldown.
 */
export function useChartWidgetAnalytics(
  params: UseChartWidgetAnalyticsParams
): ChartWidgetAnalyticsState {
  const {
    projectId,
    labelField,
    focusedSliceKey = null,
    loadDrilldown = false,
    drilldownPage = 1,
    drilldownLimit = 50,
  } = params;

  const [state, setState] = useState<ChartWidgetAnalyticsState>(EMPTY);

  useEffect(() => {
    if (!projectId || !labelField) {
      setState(EMPTY);
      return;
    }

    let cancelled = false;
    setState((prev) => ({
      ...prev,
      seriesLoading: true,
      seriesError: null,
    }));

    fetchChartSeries({ projectId, labelField })
      .then((series) => {
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
  }, [labelField, projectId]);

  useEffect(() => {
    if (!projectId || !labelField || !loadDrilldown) {
      setState((prev) => ({
        ...prev,
        drilldown: null,
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

    const sliceKey = focusedSliceKey ?? '';

    fetchChartDrilldown({
      projectId,
      labelField,
      sliceKey,
      page: drilldownPage,
      limit: drilldownLimit,
    })
      .then((drilldown) => {
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
    drilldownLimit,
    drilldownPage,
    focusedSliceKey,
    labelField,
    loadDrilldown,
    projectId,
  ]);

  return state;
}
