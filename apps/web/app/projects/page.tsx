import { getDbUser } from '@/lib/auth';
import { ProjectRegistry } from '@/app/projects/_components/project-registry';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import {
  getProjectListPaginated,
  type Project,
} from '@/app/projects/_services/projects.service.server';
import { getUserList } from '@/app/users/_services/users.service.server';

import {
  parseStandardParams,
  parseTabStatus,
  type RawSearchParams,
} from '@/lib/search-params';

const EMPTY_PROJECTS = {
  projects: [] as Project[],
  totalCount: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

export default async function ProjectsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  const resolvedSearchParams = await searchParams;
  const { page, limit, search } = parseStandardParams(resolvedSearchParams, 10);
  const status = parseTabStatus(resolvedSearchParams.tab);

  const [dbUser, usersList, projectsResult] = await Promise.all([
    getDbUser(),
    getUserList().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('error. failed to fetch users via API:', message);
      return [];
    }),
    getProjectListPaginated(page, limit, status, search).catch(
      (error: unknown) => {
        const message =
          error instanceof Error ? error.message : 'Unknown error';
        console.error('error. failed to fetch projects list via API:', message);
        return EMPTY_PROJECTS;
      }
    ),
  ]);

  const userRole = dbUser?.role ?? 'member';

  return (
    <DashboardShell description="Organize project administration.">
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
