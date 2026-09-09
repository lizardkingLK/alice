import type { DashboardBreadcrumbOverride } from '@/app/dashboard/_components/dashboard-breadcrumb';
import type { ProjectDetailsTab } from '@/lib/search-params';

export function projectDetailHref(
  projectId: string,
  tab?: ProjectDetailsTab
): string {
  if (tab && tab !== 'details') {
    return `/projects/${projectId}?tab=${tab}`;
  }
  return `/projects/${projectId}`;
}

export function buildProjectBreadcrumbOverrides(
  projectId: string,
  projectName?: string
): DashboardBreadcrumbOverride[] {
  return [
    { label: 'Dashboard', url: '/dashboard' },
    { label: 'Projects', url: '/projects' },
    {
      label: projectName || projectId,
      url: `/projects/${projectId}`,
    },
  ];
}
