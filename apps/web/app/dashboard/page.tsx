import { Suspense } from 'react';
import { DashboardOverviewData } from '@/app/dashboard/_components/dashboard-overview-data';
import { DashboardOverviewFrame } from '@/app/dashboard/_components/dashboard-overview-frame';
import { DashboardOverviewSkeleton } from '@/app/dashboard/_components/dashboard-overview-skeleton';
import type { RawSearchParams } from '@/lib/search-params';

export default function DashboardPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  return (
    <DashboardOverviewFrame>
      <Suspense fallback={<DashboardOverviewSkeleton />}>
        <DashboardOverviewData searchParams={searchParams} />
      </Suspense>
    </DashboardOverviewFrame>
  );
}
