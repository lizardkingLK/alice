import { ChartsRegistrySkeleton } from '@/app/charts/_components/charts-workspace-skeleton';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { REGISTRY_PAGES } from '@/components/registry-page-shell';

export default function ChartsLoadingPage() {
  return (
    <DashboardShell description={REGISTRY_PAGES.charts.description}>
      <ChartsRegistrySkeleton />
    </DashboardShell>
  );
}
