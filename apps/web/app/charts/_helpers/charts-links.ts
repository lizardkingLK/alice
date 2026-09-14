import type { DashboardBreadcrumbOverride } from '@/app/dashboard/_components/dashboard-breadcrumb';
import { toShortId } from '@/app/_shared/utility';

export const CHARTS_BREADCRUMBS = [
  { label: 'Dashboard', url: '/dashboard' },
  { label: 'Charts', url: '/charts' },
] as const satisfies readonly DashboardBreadcrumbOverride[];

export function chartsWorkspaceHref(workspaceId: string): string {
  return `/charts/${workspaceId}`;
}

export function buildChartsBreadcrumbOverrides(
  workspaceId: string,
  workspaceTitle?: string | null
): DashboardBreadcrumbOverride[] {
  return [
    ...CHARTS_BREADCRUMBS,
    {
      label: workspaceTitle?.trim() || toShortId(workspaceId),
      url: chartsWorkspaceHref(workspaceId),
    },
  ];
}
