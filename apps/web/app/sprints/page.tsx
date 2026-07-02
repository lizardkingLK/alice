import { redirect } from 'next/navigation';
import { CreateSprintForm } from '@/components/sprints/create-sprint-form';
import { SprintList } from '@/components/sprints/sprint-list';
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
      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <CreateSprintForm />
        <SprintList />
      </div>
    </DashboardShell>
  );
}
