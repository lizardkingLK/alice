import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';

export default function UsersLoading() {
  return (
    <DashboardShell description="Manage application users, assign workspace roles, and control access.">
      <RegistryPageSkeleton columnCount={5} rowCount={8} />
    </DashboardShell>
  );
}
