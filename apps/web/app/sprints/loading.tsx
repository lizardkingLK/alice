import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';

export default function SprintsLoading() {
  return (
    <DashboardShell description="Plan and track team sprints.">
      <RegistryPageSkeleton columnCount={5} rowCount={6} showTabs />
    </DashboardShell>
  );
}
