import { getUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardOverview } from '@/components/dashboard/dashboard-overview';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';

export default async function DashboardPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <DashboardShell
      title="Home"
      description="Track your work and team activity at a glance."
      user={user}
    >
      <DashboardOverview />
    </DashboardShell>
  );
}
