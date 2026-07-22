import { getDbUser } from '@/lib/auth';
import { ProjectRegistry } from '@/app/projects/_components/project-registry';
import {
  getProjectListPaginated,
  type Project,
} from '@/app/projects/_services/projects.service.server';
import { getUserList } from '@/app/users/_services/users.service.server';
import { safeServerFetch } from '@/lib/safe-server-fetch';
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

type ProjectsDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

export async function ProjectsData({
  searchParams,
}: Readonly<ProjectsDataProps>) {
  const resolvedSearchParams = await searchParams;
  const { page, limit, search } = parseStandardParams(resolvedSearchParams, 10);
  const status = parseTabStatus(resolvedSearchParams.tab);

  const [dbUser, usersList, projectsResult] = await Promise.all([
    getDbUser(),
    safeServerFetch(getUserList(), [], 'fetch users for project form'),
    safeServerFetch(
      getProjectListPaginated(page, limit, status, search),
      EMPTY_PROJECTS,
      'fetch projects list'
    ),
  ]);

  const userRole = dbUser?.role ?? 'member';

  return (
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
  );
}
