import { DashboardOverview } from '@/app/dashboard/_components/dashboard-overview';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';

export default async function DashboardPage() {
  return (
    <DashboardShell description="Track your work and team activity at a glance.">
      <DashboardOverview />
    </DashboardShell>
  );
}
