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
  const { data: dbSprints, error, count } = await supabase
    .from('sprints')
    .select('*, project:projects(id, name, key)', { count: 'exact' })
    .eq('created_by', user.id)
    .in('status', ['planned', 'active'])
    .order('start_date', { ascending: false })
    .range(0, 4);

  if (error) {
    console.error(
      'error. supabase database error fetching sprints:',
      error.message
    );
  }

  const sprintsList: Sprint[] = (
    (dbSprints as unknown as DbSprintRelation[]) ?? []
  ).map((element) => mapDbSprintToSprint(element));

  const initialPagination = {
    page: 1,
    limit: 5,
    totalCount: count ?? 0,
    totalPages: Math.ceil((count ?? 0) / 5) || 1,
  };

  return (
    <DashboardShell
      title="Sprints"
      description="Plan and track team sprints."
      user={user}
    >
      <SprintsWorkspace
        initialSprints={sprintsList}
        initialPagination={initialPagination}
      />
    </DashboardShell>
  );
}
