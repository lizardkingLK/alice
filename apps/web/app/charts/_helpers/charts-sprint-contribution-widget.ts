import type { ChartWidgetTypeId } from '@/app/charts/_components/charts.types';
import type { SprintContributionLoggedBand } from '@repo/types';

export const CHARTS_CONTRIBUTION_DEFAULT_TITLE = 'Sprint contribution';

export function isSprintContributionWidgetType(
  typeId: ChartWidgetTypeId
): boolean {
  return typeId === 'sprint-contribution';
}

export function sprintContributionLoggedIndicatorClass(
  band: SprintContributionLoggedBand
): string {
  switch (band) {
    case 'critical':
      return 'bg-rose-500';
    case 'low':
      return 'bg-amber-500';
    case 'mid':
      return 'bg-emerald-500';
    case 'high':
      return 'bg-sky-500';
  }
}

export const SPRINT_CONTRIBUTION_GROUP_LABELS = {
  active: 'Active',
  unassigned: 'Unassigned',
  done: 'Done',
} as const;
