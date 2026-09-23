/**
 * Sprint summary report navigation context (`?from=`).
 * Drives the unavailable-state back CTA and report breadcrumbs.
 */

export const SPRINT_REPORT_FROM_QUERY = 'from';

export type SprintReportFrom = 'sprints' | 'backlog' | 'board' | 'work-items';

export function sprintReportHref(
  sprintId: string,
  from: SprintReportFrom
): string {
  return `/sprints/${sprintId}/report?${SPRINT_REPORT_FROM_QUERY}=${from}`;
}

export function parseSprintReportFrom(
  raw: string | string[] | undefined | null
): SprintReportFrom {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === 'sprints' || value === 'board' || value === 'work-items') {
    return value;
  }
  return 'backlog';
}

export function sprintReportBackNav(from: SprintReportFrom): {
  readonly href: string;
  readonly label: string;
} {
  if (from === 'sprints') {
    return { href: '/sprints', label: 'Back to Sprints' };
  }
  if (from === 'board') {
    return { href: '/board', label: 'Back to Board' };
  }
  if (from === 'work-items') {
    return { href: '/work-items', label: 'Back to Work Items' };
  }
  return { href: '/backlog', label: 'Back to Backlog' };
}
