import { redirect } from 'next/navigation';
import { SprintsWorkspace } from '@/components/sprints/sprints-workspace';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { getUser } from '@/lib/auth';

export default async function SprintsPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <DashboardShell
      title="Sprints"
      description="Plan and track team sprints."
      user={user}
    >
      <SprintsWorkspace />
    </DashboardShell>
  );
}
