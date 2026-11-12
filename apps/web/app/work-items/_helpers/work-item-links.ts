import { isUuidSegment, toShortId } from '@/app/_shared/utility';
import type { DashboardBreadcrumbOverride } from '@/app/dashboard/_components/dashboard-breadcrumb';
import { projectDetailHref } from '@/app/projects/_helpers/project-links';
import { projectScopedHref } from '@/app/projects/_helpers/project-tree-links';

/** Query flag: open a work item from a project workspace tab. */
export const FROM_PROJECT_QUERY = 'fromProject';

/** Query flag: open a work item from My Work (/member) assignee scope. */
export const FROM_ASSIGNEE_QUERY = 'fromAssignee';

export type WorkItemDetailLinkContext = {
  readonly fromProjectId?: string | null;
  readonly fromAssigneeId?: string | null;
  /** Prefer project-tree URL when key + slug are known. */
  readonly projectKey?: string | null;
  readonly workItemSlug?: string | null;
  readonly sprintSlug?: string | null;
};

export type WorkItemBreadcrumbLabels = {
  readonly workItemTitle?: string | null;
  readonly projectName?: string | null;
  readonly projectKey?: string | null;
  readonly workItemSlug?: string | null;
};

/**
 * Detail href for a work item. Prefers `/projects/{KEY}/work-items/{slug}`
 * when project key + slug are available; falls back to legacy UUID paths.
 */
export function workItemDetailHref(
  workItemId: string,
  context: WorkItemDetailLinkContext = {}
): string {
  const {
    fromProjectId,
    fromAssigneeId,
    projectKey,
    workItemSlug,
    sprintSlug,
  } = context;

  if (projectKey && workItemSlug) {
    return projectScopedHref({
      projectKeyOrId: projectKey,
      area: 'work-items',
      workItemSlug,
      sprintSlug,
    });
  }

  if (fromProjectId && isUuidSegment(fromProjectId)) {
    return `/work-items/${workItemId}?${FROM_PROJECT_QUERY}=${fromProjectId}`;
  }

  if (fromAssigneeId && isUuidSegment(fromAssigneeId)) {
    return `/work-items/${workItemId}?${FROM_ASSIGNEE_QUERY}=${fromAssigneeId}`;
  }

  return `/work-items/${workItemId}`;
}

/**
 * Shell breadcrumb for work-item detail — always project-scoped when possible:
 * Dashboard → Projects → {project} → Work Items → {item}
 *
 * Navigation history (query flags) is ignored; use the browser back button.
 * Prefer titles/names; fall back to short ids when labels are unavailable.
 */
export function buildWorkItemBreadcrumbOverrides(
  workItemId: string,
  projectId?: string | null,
  labels: WorkItemBreadcrumbLabels = {}
): DashboardBreadcrumbOverride[] {
  const workItemLabel = labels.workItemTitle?.trim() || toShortId(workItemId);
  const projectKey = labels.projectKey?.trim() || null;
  const projectRef = projectKey || projectId;
  const projectLabel =
    labels.projectName?.trim() ||
    projectKey ||
    (projectId && isUuidSegment(projectId) ? toShortId(projectId) : 'Project');

  if (projectRef && (projectKey || isUuidSegment(projectId ?? ''))) {
    const detailUrl =
      projectKey && labels.workItemSlug
        ? projectScopedHref({
            projectKeyOrId: projectKey,
            area: 'work-items',
            workItemSlug: labels.workItemSlug,
          })
        : `/work-items/${workItemId}`;
    return [
      { label: 'Dashboard', url: '/dashboard' },
      { label: 'Projects', url: '/projects' },
      {
        label: projectLabel,
        url: projectDetailHref(projectRef),
      },
      {
        label: 'Work Items',
        url: projectDetailHref(projectRef, 'work-items'),
      },
      {
        label: workItemLabel,
        url: detailUrl,
      },
    ];
  }

  return [
    { label: 'Dashboard', url: '/dashboard' },
    { label: 'Work Items', url: '/work-items' },
    { label: workItemLabel, url: `/work-items/${workItemId}` },
  ];
}
