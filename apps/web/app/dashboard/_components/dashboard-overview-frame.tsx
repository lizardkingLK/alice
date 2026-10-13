import type { ReactNode } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';

export const DASHBOARD_OVERVIEW_DESCRIPTION =
  'Pinned chart workspaces — slide between boards, or customize on Charts.';

/** Shared shell chrome for `/dashboard` page + soft-nav loading. */
export function DashboardOverviewFrame({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <DashboardShell description={DASHBOARD_OVERVIEW_DESCRIPTION}>
      {children}
    </DashboardShell>
  );
}
