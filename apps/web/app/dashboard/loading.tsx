import { DashboardOverviewFrame } from '@/app/dashboard/_components/dashboard-overview-frame';
import { DashboardOverviewSkeleton } from '@/app/dashboard/_components/dashboard-overview-skeleton';

export default function DashboardLoading() {
  return (
    <DashboardOverviewFrame>
      <DashboardOverviewSkeleton />
    </DashboardOverviewFrame>
  );
}
