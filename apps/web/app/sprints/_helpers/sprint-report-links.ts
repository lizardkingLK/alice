/**
 * Sprint summary report navigation context (`?from=`).
 * Drives the unavailable-state back CTA and report breadcrumbs.
 */

export const SPRINT_REPORT_FROM_QUERY = 'from';

export type SprintReportFrom = 'sprints' | 'backlog';

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
  return value === 'sprints' ? 'sprints' : 'backlog';
}

export function sprintReportBackNav(from: SprintReportFrom): {
  readonly href: string;
  readonly label: string;
} {
  if (from === 'sprints') {
    return { href: '/sprints', label: 'Back to Sprints' };
  }
  return { href: '/backlog', label: 'Back to Backlog' };
}
