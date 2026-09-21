import { ALL_PROJECTS_ID } from '@/app/board/_helpers/board-defaults-storage';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import type {
  ChartsQuickFieldId,
  ChartsWidgetFilterDraft,
} from '@/app/charts/_components/charts-sample.data';

const DEFAULT_QUICK_SELECTIONS: Record<ChartsQuickFieldId, string> = {
  project: 'all',
  sprint: 'all',
  status: 'all',
  type: 'all',
  assignee: 'all',
  priority: 'all',
};

/**
 * Seed per-widget filters from workspace defaults (All projects + optional sprint).
 */
export function createChartWidgetFiltersFromDefaults(
  preference: BoardDefaultsPreference | null | undefined
): ChartsWidgetFilterDraft {
  const projectId =
    !preference || preference.projectId === ALL_PROJECTS_ID
      ? 'all'
      : preference.projectId;
  const sprintId = preference?.sprintId?.trim() || undefined;

  return {
    mode: 'quick',
    projectId,
    rows: [],
    quickSelections: {
      ...DEFAULT_QUICK_SELECTIONS,
      project: projectId,
      sprint: sprintId ?? 'all',
    },
    ...(sprintId ? { sprintId } : {}),
  };
}
