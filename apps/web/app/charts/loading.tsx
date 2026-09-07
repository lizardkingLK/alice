import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';
import { REGISTRY_PAGES } from '@/components/registry-page-shell';

const CHARTS_BREADCRUMBS = [
  { label: 'Dashboard', url: '/dashboard' },
  { label: 'Charts', url: '/charts' },
] as const;

export default function ChartsLoadingPage() {
  const meta = REGISTRY_PAGES.charts;
  return (
    <DashboardShell
      description={meta.description}
      breadcrumbOverrides={[...CHARTS_BREADCRUMBS]}
      contentScrollable={false}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <RegistryPageSkeleton {...meta.skeleton} />
    </DashboardShell>
  );
}
