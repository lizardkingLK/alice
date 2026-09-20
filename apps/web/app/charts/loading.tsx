import { ChartsDashboardShell } from '@/app/charts/_components/charts-dashboard-shell';
import { ChartsWorkspaceSkeleton } from '@/app/charts/_components/charts-workspace-skeleton';

export default function ChartsLoadingPage() {
  return (
    <ChartsDashboardShell>
      <ChartsWorkspaceSkeleton />
    </ChartsDashboardShell>
  );
}
