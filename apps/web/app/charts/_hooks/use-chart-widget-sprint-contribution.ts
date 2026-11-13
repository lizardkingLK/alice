'use client';

import { useEffect, useState } from 'react';
import type { ChartSprintContributionResponse } from '@repo/types';
import { fetchChartSprintContribution } from '@/app/charts/_services/charts.analytics.client';

export const CHARTS_CONTRIBUTION_EMPTY_NO_SCOPE =
  'Select a project and sprint in filters to load contribution.';
export const CHARTS_CONTRIBUTION_EMPTY_UNAVAILABLE =
  'Sprint contribution is temporarily unavailable.';

export type ChartWidgetSprintContributionState = {
  readonly loading: boolean;
  readonly payload: ChartSprintContributionResponse | null;
  readonly emptyHint: string | null;
  readonly error: string | null;
};

const IDLE: ChartWidgetSprintContributionState = {
  loading: false,
  payload: null,
  emptyHint: CHARTS_CONTRIBUTION_EMPTY_NO_SCOPE,
  error: null,
};

export function useChartWidgetSprintContribution(params: {
  readonly projectId: string | undefined;
  readonly sprintId: string | undefined;
  readonly assigneeId?: string;
}): ChartWidgetSprintContributionState {
  const { projectId, sprintId, assigneeId } = params;
  const [state, setState] = useState<ChartWidgetSprintContributionState>(() =>
    projectId && sprintId ? { ...IDLE, loading: true, emptyHint: null } : IDLE
  );

  useEffect(() => {
    if (!projectId || !sprintId) {
      setState(IDLE);
      return;
    }

    let cancelled = false;
    setState((previous) => ({
      ...previous,
      loading: true,
      emptyHint: null,
      error: null,
    }));

    void (async () => {
      try {
        const payload = await fetchChartSprintContribution({
          projectId,
          sprintId,
          ...(assigneeId !== undefined ? { assigneeId } : {}),
        });
        if (cancelled) {
          return;
        }
        const rowCount = payload.groups.reduce(
          (sum, group) => sum + group.rows.length,
          0
        );
        setState({
          loading: false,
          payload,
          emptyHint:
            rowCount === 0
              ? 'No sprint work items match the selected filters.'
              : null,
          error: null,
        });
      } catch {
        if (cancelled) {
          return;
        }
        setState({
          loading: false,
          payload: null,
          emptyHint: CHARTS_CONTRIBUTION_EMPTY_UNAVAILABLE,
          error: CHARTS_CONTRIBUTION_EMPTY_UNAVAILABLE,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, sprintId, assigneeId]);

  return state;
}
