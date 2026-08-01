import { Suspense } from 'react';
import { DashboardOverviewData } from '@/app/dashboard/_components/dashboard-overview-data';
import { DashboardOverviewFrame } from '@/app/dashboard/_components/dashboard-overview-frame';
import { DashboardOverviewSkeleton } from '@/app/dashboard/_components/dashboard-overview-skeleton';

export default function DashboardPage() {
  return (
    <DashboardOverviewFrame>
      <Suspense fallback={<DashboardOverviewSkeleton />}>
        <DashboardOverviewData />
      </Suspense>
    </DashboardOverviewFrame>
  );
}
