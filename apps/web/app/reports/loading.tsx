import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ReportsPageSkeleton } from '@/app/reports/_components/reports-page-skeleton';

export default function ReportsLoading() {
  return (
    <DashboardShell description="Generate a personal daily report from your assigned work items.">
      <ReportsPageSkeleton />
    </DashboardShell>
  );
}
