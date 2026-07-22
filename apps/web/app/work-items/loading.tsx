import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';

export default function WorkItemsLoading() {
  return (
    <DashboardShell description="Manage Work Items.">
      <RegistryPageSkeleton columnCount={7} rowCount={8} />
    </DashboardShell>
  );
}
