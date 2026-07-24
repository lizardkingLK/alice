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
 * Detail href for a work item. Pass project or assignee context so the detail
 * page can build a history-preserving breadcrumb trail.
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
 * Breadcrumb trail for work-item detail.
 * - `fromProjectId` → Dashboard → Projects → project → Work Items → item
 * - `fromAssigneeId` → Dashboard → My Work → item
 * - otherwise → Dashboard → Work Items → item
 */
export function buildWorkItemBreadcrumbOverrides(
  workItemId: string,
  context: WorkItemDetailLinkContext = {}
): DashboardBreadcrumbOverride[] {
  const { fromProjectId, fromAssigneeId } = context;
  const shortWorkItemId = toShortId(workItemId);

  if (fromProjectId && isUuidSegment(fromProjectId)) {
    return [
      { label: 'Dashboard', url: '/dashboard' },
      { label: 'Projects', url: '/projects' },
      {
        label: toShortId(fromProjectId),
        url: `/projects/${fromProjectId}`,
      },
      {
        label: 'Work Items',
        url: `/projects/${fromProjectId}?tab=work-items`,
      },
      {
        label: shortWorkItemId,
        url: workItemDetailHref(workItemId, { fromProjectId }),
      },
    ];
  }

  if (fromAssigneeId && isUuidSegment(fromAssigneeId)) {
    return [
      { label: 'Dashboard', url: '/dashboard' },
      { label: 'My Work', url: '/member' },
      {
        label: shortWorkItemId,
        url: workItemDetailHref(workItemId, { fromAssigneeId }),
      },
    ];
  }

  return [
    { label: 'Dashboard', url: '/dashboard' },
    { label: 'Work Items', url: '/work-items' },
    { label: shortWorkItemId, url: `/work-items/${workItemId}` },
  ];
}
