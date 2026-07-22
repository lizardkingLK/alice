import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';

export default function ManagerLoading() {
  return (
    <DashboardShell description="Manage teams workload and engineering resources.">
      <RegistryPageSkeleton columnCount={6} rowCount={8} showTabs />
    </DashboardShell>
  );
}
