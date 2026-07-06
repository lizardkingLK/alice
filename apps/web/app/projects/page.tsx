import { redirect } from 'next/navigation';
import { getUser, getDbUser } from '@/lib/auth';
import { ProjectRegistry } from '@/app/projects/_components/project-registry';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { getProjectList } from '@/app/projects/_services/projects.service';
import { getUserList } from '@/app/projects/_services/users.service';

export default async function ProjectsPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const dbUser = await getDbUser();
  const userRole = dbUser?.role ?? 'member';

  // Fetch all active users to populate the Project Owner choices
  const usersList = await getUserList();
  const projectsList = await getProjectList();

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
