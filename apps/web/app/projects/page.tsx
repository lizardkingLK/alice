import { redirect } from 'next/navigation';
import { getUser, getDbUser } from '@/lib/auth';
import { ProjectRegistry } from '@/app/projects/_components/project-registry';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import {
  getProjectListPaginated,
  type Project,
} from '@/app/projects/_services/projects.service.server';
import { getUserList } from '@/app/users/_services/users.service.server';

export default async function ProjectsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    page?: string;
    limit?: string;
    tab?: string;
    search?: string;
  }>;
}>) {
  const resolvedSearchParams = await searchParams;
  const page = Number.parseInt(resolvedSearchParams.page ?? '1', 10);
  const limit = Number.parseInt(resolvedSearchParams.limit ?? '10', 10);
  const status =
    resolvedSearchParams.tab === 'archived' ? 'archived' : 'active';
  const search = resolvedSearchParams.search ?? '';

  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const dbUser = await getDbUser();
  const userRole = dbUser?.role ?? 'member';

  // Fetch all active users to populate the Project Owner choices
  const usersList = (await getUserList()) ?? [];

  let projectsResult = {
    projects: [] as Project[],
    totalCount: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  };
  try {
    projectsResult = await getProjectListPaginated(page, limit, status, search);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('error. failed to fetch projects list via API:', message);
  }

  return (
    <DashboardShell
      title="Projects"
      description="Organize project administration."
      user={user}
    >
      <ProjectRegistry
        projects={projectsResult.projects}
        totalCount={projectsResult.totalCount}
        page={projectsResult.page}
        limit={projectsResult.limit}
        totalPages={projectsResult.totalPages}
        tab={status}
        search={search}
        users={usersList}
        currentUserId={dbUser?.id}
        currentUserRole={userRole}
      />
    </DashboardShell>
  );
}
