import { redirect } from 'next/navigation';
import { getUser, getDbUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import { ProjectRegistry } from './project-registry';
import type { Tables } from '@repo/types';

type DbUser = Tables<'users'>;
type DbProject = Tables<'projects'> & {
  owner?: Pick<DbUser, 'id' | 'name' | 'email'> | null;
};

export default async function AdminPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const dbUser = await getDbUser();
  const userRole = dbUser?.role ?? 'member';

  const supabase = await createClient();

  // Fetch all active users to populate the Project Owner choices
  const { data: usersData, error: usersError } = await supabase
    .from('users')
    .select(
      'id, name, email, active, role, status, profile_picture, created_by, created_at, updated_by, updated_at'
    )
    .eq('active', true)
    .order('name', { ascending: true });

  if (usersError) {
    console.error(
      'error. supabase database error fetching users:',
      usersError.message
    );
  }

  // Fetch all projects including soft-deleted ones (which have deleted_at set)
  // Join the owner details using the foreign key constraint relationship name.
  // Note: We cast the query as any because the generated database types do not
  // contain relationship metadata, causing postgrest-js type inference to fail.
  const { data: projectsData, error: projectsError } = await supabase
    .from('projects')
    .select('*, owner:users!projects_owner_id_fkey(id, name, email)')
    .order('created_at', { ascending: false });

  if (projectsError) {
    console.error(
      'error. supabase database error fetching projects:',
      projectsError.message
    );
  }

  const projectsList = (projectsData as unknown as DbProject[]) ?? [];
  const usersList: DbUser[] = usersData ?? [];

  return (
    <DashboardShell
      title="Admin"
      description="Organization settings and project administration."
      user={user}
    >
      <div className="w-full">
        <ProjectRegistry
          projects={projectsList}
          users={usersList}
          currentUserId={dbUser?.id}
          currentUserRole={userRole}
        />
      </div>
    </DashboardShell>
  );
}
