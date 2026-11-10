/**
 * Sprint summary report navigation context (`?from=`).
 * Drives the unavailable-state back CTA and report breadcrumbs.
 */

import { isUuidSegment, toShortId } from '@/app/_shared/utility';
import type { DashboardBreadcrumbOverride } from '@/app/dashboard/_components/dashboard-breadcrumb';
import {
  looksLikeProjectKey,
  projectDetailHref,
} from '@/app/projects/_helpers/project-links';
import { projectScopedHref } from '@/app/projects/_helpers/project-tree-links';

export const SPRINT_REPORT_FROM_QUERY = 'from';

export type SprintReportFrom =
  'sprints' | 'backlog' | 'board' | 'work-items' | 'project';

export function sprintReportHref(
  sprintId: string,
  from: SprintReportFrom,
  tree?: {
    readonly projectKey?: string | null;
    readonly sprintSlug?: string | null;
  }
): string {
  if (tree?.projectKey && tree.sprintSlug) {
    return projectScopedHref({
      projectKeyOrId: tree.projectKey,
      area: 'sprints',
      sprintSlug: tree.sprintSlug,
      summaryReport: true,
    });
  }
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
  if (
    from === 'project' &&
    projectId &&
    (isUuidSegment(projectId) || looksLikeProjectKey(projectId))
  ) {
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
  readonly slug?: string | null;
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
    const projectRef = project.key?.trim() || project.id;
    const projectLabel =
      project.name?.trim() || project.key?.trim() || toShortId(project.id);
    const sprintSlug =
      'slug' in sprint && typeof sprint.slug === 'string' ? sprint.slug : null;
    const treeReportUrl =
      project.key?.trim() && sprintSlug
        ? sprintReportHref(sprint.id, from, {
            projectKey: project.key.trim(),
            sprintSlug,
          })
        : reportUrl;
    return [
      { label: 'Dashboard', url: '/dashboard' },
      { label: 'Projects', url: '/projects' },
      {
        label: projectLabel,
        url: projectDetailHref(projectRef),
      },
      {
        label: 'Sprints',
        url: projectDetailHref(projectRef, 'sprints'),
      },
      {
        label: sprintLabel,
        url: treeReportUrl,
      },
    ];
  }

  return [
    { label: 'Dashboard', url: '/dashboard' },
    { label: 'Sprints', url: '/sprints' },
    { label: sprintLabel, url: reportUrl },
  ];
}
