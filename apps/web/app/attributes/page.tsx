import { redirect } from 'next/navigation';
import { getUser } from '../../lib/auth';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';

export default async function AttributesDashboard() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  /** Custom RBAC: load role from application database once implemented. */

  return (
    <DashboardShell
      title="Attributes"
      description="Manage Attributes Data."
      user={user}
    >
      <div className="text-muted-foreground flex h-40 items-center justify-center rounded-lg border border-dashed text-sm">
        Attributes Workspace — content coming soon.
      </div>
    </DashboardShell>
  );
}
