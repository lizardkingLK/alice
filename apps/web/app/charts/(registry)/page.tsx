import { Suspense } from 'react';
import { ChartsRegistryData } from '@/app/charts/_components/charts-registry-data';
import { ChartsRegistrySkeleton } from '@/app/charts/_components/charts-workspace-skeleton';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { REGISTRY_PAGES } from '@/components/registry-page-shell';
import type { RawSearchParams } from '@/lib/search-params';

/** Charts workspace registry — list, filter tabs, create, open boards. */
export default function ChartsIndexPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <DashboardShell description={REGISTRY_PAGES.charts.description}>
      <Suspense fallback={<ChartsRegistrySkeleton />}>
        <ChartsRegistryData searchParams={searchParams} />
      </Suspense>
    </DashboardShell>
  );
}
