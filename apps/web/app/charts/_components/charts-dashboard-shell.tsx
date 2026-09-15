import type { ReactNode } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { REGISTRY_PAGES } from '@/components/registry-page-shell';
import {
  buildChartsBreadcrumbOverrides,
  CHARTS_BREADCRUMBS,
} from '@/app/charts/_helpers/charts-links';

type ChartsDashboardShellProps = {
  readonly children: ReactNode;
  readonly workspaceId?: string;
  /** When set with workspaceId, hide `/widget/...` path crumbs. */
  readonly breadcrumbAsTrail?: boolean;
};

/** Shared Charts registry shell (breadcrumbs + content layout). */
export function ChartsDashboardShell({
  children,
  workspaceId,
  breadcrumbAsTrail = false,
}: Readonly<ChartsDashboardShellProps>) {
  const meta = REGISTRY_PAGES.charts;
  const breadcrumbOverrides = workspaceId
    ? buildChartsBreadcrumbOverrides(workspaceId)
    : [...CHARTS_BREADCRUMBS];

  return (
    <DashboardShell
      description={meta.description}
      breadcrumbOverrides={breadcrumbOverrides}
      breadcrumbAsTrail={breadcrumbAsTrail || Boolean(workspaceId)}
      contentScrollable={false}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      {children}
    </DashboardShell>
  );
}
