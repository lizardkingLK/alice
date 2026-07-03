import { redirect } from 'next/navigation';
import { SprintsWorkspace } from '@/components/sprints/sprints-workspace';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Sprint } from '@/lib/api-client';

const dbStatusToResponseMap = {
  planned: 'Not Started',
  active: 'Ongoing',
  closed: 'Completed',
} as const;

type DbSprintRelation = {
  id: string;
  name: string;
  goal: string | null;
  status: 'planned' | 'active' | 'closed';
  start_date: string;
  end_date: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  project: {
    id: string;
    name: string;
    key: string;
  } | null;
};

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
    console.error('error. supabase database error fetching sprints:', error.message);
  }

  const sprintsList: Sprint[] = (
    (dbSprints as unknown as DbSprintRelation[]) ?? []
  ).map((row) => ({
    id: row.id,
    name: row.name,
    goal: row.goal,
    status: dbStatusToResponseMap[row.status] || 'Not Started',
    startDate: row.start_date,
    endDate: row.end_date,
    createdBy: row.created_by ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    project: row.project
      ? {
          id: row.project.id,
          name: row.project.name,
          key: row.project.key,
        }
      : null,
  }));

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

