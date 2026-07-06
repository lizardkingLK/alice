import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { SprintsWorkspace } from '@/app/sprints/_components/sprints-workspace';
import {
  mapDbSprintToSprint,
  type DbSprintRelation,
  type Sprint,
} from '@/app/sprints/_services/sprints.service';

export default async function SprintsPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const supabase = await createClient();
  const { data: dbSprints, error } = await supabase
    .from('sprints')
    .select('*, project:projects(id, name, key)')
    .eq('created_by', user.id)
    .order('start_date', { ascending: false });

  if (error) {
    console.error(
      'error. supabase database error fetching sprints:',
      error.message
    );
  }

  const sprintsList: Sprint[] = (
    (dbSprints as unknown as DbSprintRelation[]) ?? []
  ).map((element) => mapDbSprintToSprint(element));

  return (
    <DashboardShell
      title="Sprints"
      description="Plan and track team sprints."
      user={user}
    >
      <SprintsWorkspace initialSprints={sprintsList} />
    </DashboardShell>
  );
}
