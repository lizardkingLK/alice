import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ChartsData } from '@/app/charts/_components/charts-data';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';
import { REGISTRY_PAGES } from '@/components/registry-page-shell';
import type { RawSearchParams } from '@/lib/search-params';

const CHARTS_BREADCRUMBS = [
  { label: 'Dashboard', url: '/dashboard' },
  { label: 'Charts', url: '/charts' },
] as const;

export default function ChartsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  const meta = REGISTRY_PAGES.charts;
  return (
    <DashboardShell
      description={meta.description}
      breadcrumbOverrides={[...CHARTS_BREADCRUMBS]}
      contentScrollable={false}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
    >
      <Suspense fallback={<RegistryPageSkeleton {...meta.skeleton} />}>
        <ChartsData searchParams={searchParams} />
      </Suspense>
    </DashboardShell>
  );
}
