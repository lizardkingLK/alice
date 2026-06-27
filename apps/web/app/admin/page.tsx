import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default async function AdminPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  /** Custom RBAC: load role from application database once implemented. */

  return (
    <DashboardShell
      title="Admin"
      description="Organization settings and project administration."
      user={user}
    >
      <div className="text-muted-foreground flex h-40 items-center justify-center rounded-lg border border-dashed text-sm">
        Admin workspace — content coming soon.
      </div>
    </DashboardShell>
  );
}
