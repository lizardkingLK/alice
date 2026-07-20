import { DashboardOverview } from '@/app/dashboard/_components/dashboard-overview';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';

export default async function DashboardPage() {
  return (
    <DashboardShell description="Customize your overview — drag, resize, and glance at team progress.">
      <DashboardOverview />
    </DashboardShell>
  );
}
