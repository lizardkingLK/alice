import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { RegistryPageSkeleton } from '@/components/registry-page-skeleton';

export default function ProjectsLoading() {
  return (
    <DashboardShell description="Organize project administration.">
      <RegistryPageSkeleton columnCount={6} rowCount={8} showTabs />
    </DashboardShell>
  );
}
