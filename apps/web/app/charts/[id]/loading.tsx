import { ChartsWorkspaceSkeleton } from '@/app/charts/_components/charts-workspace-skeleton';
import { ChartsDashboardShell } from '@/app/charts/_components/charts-dashboard-shell';

/** Board-only loading UI — does not apply to the `/charts` registry. */
export default function ChartsWorkspaceLoadingPage() {
  return (
    <ChartsDashboardShell>
      <ChartsWorkspaceSkeleton />
    </ChartsDashboardShell>
  );
}
