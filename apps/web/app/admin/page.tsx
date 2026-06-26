import { redirect } from 'next/navigation';
import { getUser } from '../../lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default async function AdminPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  // TODO: enforce custom RBAC role check once application roles are stored in the database.

  return (
    <DashboardShell
      title="Admin"
      description="Organization settings and project administration."
    >
      <div className="text-muted-foreground flex h-40 items-center justify-center rounded-lg border border-dashed text-sm">
        Admin workspace — content coming soon.
      </div>
    </DashboardShell>
  );
}
