'use client';

import { useEffect, useState } from 'react';
import type { SprintBurndownPayload } from '@repo/types';
import {
  applyBurndownPayload,
  defaultBurndownAxisRange,
  type BurndownAxisRange,
  type BurndownPoint,
} from '@/components/burndown-line-chart';
import { fetchSprintBurndown } from '@/app/charts/_services/charts.burndown.client';

export const CHARTS_BURNDOWN_EMPTY_NO_SPRINT =
  'Select a project and sprint in filters to load burndown.';
export const CHARTS_BURNDOWN_EMPTY_UNAVAILABLE =
  'Burndown is temporarily unavailable for this sprint.';

export type ChartWidgetBurndownState = {
  readonly loading: boolean;
  readonly series: readonly BurndownPoint[];
  readonly estimatedTotal: number;
  readonly axisRange: BurndownAxisRange;
  readonly emptyHint: string | null;
  readonly sprintName: string | null;
  readonly payload: SprintBurndownPayload | null;
};

const IDLE: ChartWidgetBurndownState = {
  loading: false,
  series: [],
  estimatedTotal: 0,
  axisRange: defaultBurndownAxisRange(),
  emptyHint: CHARTS_BURNDOWN_EMPTY_NO_SPRINT,
  sprintName: null,
  payload: null,
};

export function useChartWidgetBurndown(
  sprintId: string | undefined
): ChartWidgetBurndownState {
  const [state, setState] = useState<ChartWidgetBurndownState>(() =>
    sprintId ? { ...IDLE, loading: true, emptyHint: null } : IDLE
  );

  useEffect(() => {
    if (!sprintId) {
      setState(IDLE);
      return;
    }

    let cancelled = false;
    setState((prev) => ({
      ...prev,
      loading: true,
      emptyHint: null,
    }));

    void (async () => {
      try {
        const payload = await fetchSprintBurndown(sprintId);
        if (cancelled) {
          return;
        }
        const applied = applyBurndownPayload(payload);
        setState({
          loading: false,
          series: applied.series,
          estimatedTotal: applied.estimatedTotal,
          axisRange: applied.axisRange,
          emptyHint:
            applied.series.length === 0
              ? CHARTS_BURNDOWN_EMPTY_UNAVAILABLE
              : null,
          sprintName: payload.sprint.name,
          payload,
        });
      } catch {
        if (cancelled) {
          return;
        }
        setState({
          loading: false,
          series: [],
          estimatedTotal: 0,
          axisRange: defaultBurndownAxisRange(),
          emptyHint: CHARTS_BURNDOWN_EMPTY_UNAVAILABLE,
          sprintName: null,
          payload: null,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sprintId]);

  return state;
}
