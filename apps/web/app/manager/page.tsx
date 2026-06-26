import { redirect } from 'next/navigation';
import { getUser } from '../../lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default async function ManagerDashboard() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  // TODO: enforce custom RBAC role check once application roles are stored in the database.

  return (
    <DashboardShell
      title="Team"
      description="Manage your team's workload and sprints."
    >
      <div className="text-muted-foreground flex h-40 items-center justify-center rounded-lg border border-dashed text-sm">
        Manager workspace — content coming soon.
      </div>
    </DashboardShell>
  );
}
