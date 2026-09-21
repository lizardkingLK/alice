import { Suspense } from 'react';
import { ChartsDashboardShell } from '@/app/charts/_components/charts-dashboard-shell';
import { ChartsData } from '@/app/charts/_components/charts-data';
import { ChartsWorkspaceSkeleton } from '@/app/charts/_components/charts-workspace-skeleton';
import type { RawSearchParams } from '@/lib/search-params';

type ChartsWorkspacePageShellProps = {
  readonly searchParams: Promise<RawSearchParams>;
  readonly workspaceId: string;
  readonly currentUserId: string;
  readonly focusWidgetId?: string;
};

/** Workspace route body shared by `/charts/[id]` and widget deep-links. */
export function ChartsWorkspacePageShell({
  searchParams,
  workspaceId,
  currentUserId,
  focusWidgetId,
}: Readonly<ChartsWorkspacePageShellProps>) {
  return (
    <ChartsDashboardShell workspaceId={workspaceId} breadcrumbAsTrail>
      <Suspense fallback={<ChartsWorkspaceSkeleton />}>
        <ChartsData
          searchParams={searchParams}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          focusWidgetId={focusWidgetId}
        />
      </Suspense>
    </ChartsDashboardShell>
  );
}
