import { redirect } from 'next/navigation';
import { getUser, getDbUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import type { Tables } from '@repo/types';
import { ProjectRegistry } from '@/app/projects/_components/project-registry';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';

type DbUser = Tables<'users'>;
type DbProject = Tables<'projects'> & {
  owner?: Pick<DbUser, 'id' | 'name' | 'email'> | null;
};

export default async function ProjectsPage() {
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

  // Fetch all projects including soft-deleted ones via Express API
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;

  let projectsList: DbProject[] = [];

  if (token) {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/projects`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          next: { revalidate: 0 },
        }
      );

      if (response.ok) {
        const data = (await response.json()) as { projects?: DbProject[] };
        projectsList = data.projects ?? [];
      } else {
        console.error(
          'Failed to fetch projects from API:',
          response.statusText
        );
      }
    } catch (err) {
      console.error('Error fetching projects from API:', err);
    }
  }

  const usersList: DbUser[] = usersData ?? [];

  return (
    <DashboardShell
      title="Projects"
      description="Organize project administration."
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
