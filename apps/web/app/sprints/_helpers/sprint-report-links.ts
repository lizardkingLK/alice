/**
 * Sprint summary report navigation context (`?from=`).
 * Drives the unavailable-state back CTA and report breadcrumbs.
 */

import { isUuidSegment, toShortId } from '@/app/_shared/utility';
import type { DashboardBreadcrumbOverride } from '@/app/dashboard/_components/dashboard-breadcrumb';
import { projectDetailHref } from '@/app/projects/_helpers/project-links';

export const SPRINT_REPORT_FROM_QUERY = 'from';

export type SprintReportFrom =
  'sprints' | 'backlog' | 'board' | 'work-items' | 'project';

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
  if (
    value === 'sprints' ||
    value === 'board' ||
    value === 'work-items' ||
    value === 'project'
  ) {
    return value;
  }
  return 'backlog';
}

export function sprintReportBackNav(
  from: SprintReportFrom,
  projectId?: string | null
): {
  readonly href: string;
  readonly label: string;
} {
  if (from === 'project' && projectId && isUuidSegment(projectId)) {
    return {
      href: projectDetailHref(projectId, 'sprints'),
      label: 'Back to Sprints',
    };
  }
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

export type SprintReportBreadcrumbSprint = {
  readonly id: string;
  readonly name?: string | null;
  readonly project?: {
    readonly id: string;
    readonly name?: string | null;
    readonly key?: string | null;
  } | null;
};

/**
 * Shell breadcrumb for sprint summary report — project-scoped when possible:
 * Dashboard → Projects → {project} → Sprints → {sprint}
 *
 * The final segment is the sprint name (the report page). Sprints links to the
 * project details Sprints tab.
 */
export function buildSprintReportBreadcrumbOverrides(
  sprint: SprintReportBreadcrumbSprint,
  from: SprintReportFrom
): DashboardBreadcrumbOverride[] {
  const reportUrl = sprintReportHref(sprint.id, from);
  const sprintLabel = sprint.name?.trim() || toShortId(sprint.id);
  const project = sprint.project;

  if (project?.id && isUuidSegment(project.id)) {
    const projectLabel =
      project.name?.trim() || project.key?.trim() || toShortId(project.id);
    return [
      { label: 'Dashboard', url: '/dashboard' },
      { label: 'Projects', url: '/projects' },
      {
        label: projectLabel,
        url: projectDetailHref(project.id),
      },
      {
        label: 'Sprints',
        url: projectDetailHref(project.id, 'sprints'),
      },
      {
        label: sprintLabel,
        url: reportUrl,
      },
    ];
  }

  return [
    { label: 'Dashboard', url: '/dashboard' },
    { label: 'Sprints', url: '/sprints' },
    { label: sprintLabel, url: reportUrl },
  ];
}
