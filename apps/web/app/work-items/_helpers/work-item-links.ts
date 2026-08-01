import { isUuidSegment, toShortId } from '@/app/_shared/utility';
import type { DashboardBreadcrumbOverride } from '@/app/dashboard/_components/dashboard-breadcrumb';

/** Query flag: open a work item from a project workspace tab. */
export const FROM_PROJECT_QUERY = 'fromProject';

/** Query flag: open a work item from My Work (/member) assignee scope. */
export const FROM_ASSIGNEE_QUERY = 'fromAssignee';

export type WorkItemDetailLinkContext = {
  readonly fromProjectId?: string | null;
  readonly fromAssigneeId?: string | null;
};

/**
 * Detail href for a work item. Optional query context is kept for callers that
 * still pass it; the shell breadcrumb always uses the work item's project_id.
 */
export function workItemDetailHref(
  workItemId: string,
  context: WorkItemDetailLinkContext = {}
): string {
  const { fromProjectId, fromAssigneeId } = context;

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
 */
export function buildWorkItemBreadcrumbOverrides(
  workItemId: string,
  projectId?: string | null
): DashboardBreadcrumbOverride[] {
  const shortWorkItemId = toShortId(workItemId);

  if (projectId && isUuidSegment(projectId)) {
    return [
      { label: 'Dashboard', url: '/dashboard' },
      { label: 'Projects', url: '/projects' },
      {
        label: toShortId(projectId),
        url: `/projects/${projectId}`,
      },
      {
        label: 'Work Items',
        url: `/projects/${projectId}?tab=work-items`,
      },
      {
        label: shortWorkItemId,
        url: `/work-items/${workItemId}`,
      },
    ];
  }

  return [
    { label: 'Dashboard', url: '/dashboard' },
    { label: 'Work Items', url: '/work-items' },
    { label: shortWorkItemId, url: `/work-items/${workItemId}` },
  ];
}
