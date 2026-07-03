import { DashboardOverview } from '@/app/dashboard/_components/dashboard-overview';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { getUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

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
