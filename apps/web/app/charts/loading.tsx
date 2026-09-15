import { ChartsDashboardShell } from '@/app/charts/_components/charts-dashboard-shell';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';
import { REGISTRY_PAGES } from '@/components/registry-page-shell';

export default function ChartsLoadingPage() {
  const meta = REGISTRY_PAGES.charts;
  return (
    <ChartsDashboardShell>
      <RegistryPageSkeleton {...meta.skeleton} />
    </ChartsDashboardShell>
  );
}
