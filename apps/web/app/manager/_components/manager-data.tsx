import { getDbUser } from '@/lib/auth';
import { TeamRegistry } from '@/app/manager/_components/team-registry';
import {
  getTeamListPaginated,
  type Team,
} from '@/app/manager/_services/teams.service.server';
import { getUserList } from '@/app/users/_services/users.service.server';
import { getProjectList } from '@/app/projects/_services/projects.service.server';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  parseStandardParams,
  parseManagerTabStatus,
  type RawSearchParams,
} from '@/lib/search-params';

const EMPTY_TEAMS = {
  teams: [] as Team[],
  totalCount: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

type ManagerDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

export async function ManagerData({
  searchParams,
}: Readonly<ManagerDataProps>) {
  const resolvedSearchParams = await searchParams;
  const { page, limit, search } = parseStandardParams(resolvedSearchParams, 10);
  const status = parseManagerTabStatus(resolvedSearchParams.tab);

  const [dbUser, usersList, teamsResult, projectsList] = await Promise.all([
    getDbUser(),
    safeServerFetch(getUserList(), [], 'fetch users for team form'),
    safeServerFetch(
      getTeamListPaginated(page, limit, status, search),
      EMPTY_TEAMS,
      'fetch teams list'
    ),
    safeServerFetch(getProjectList(), [], 'fetch projects for team form'),
  ]);

  const activeProjects = filterActiveProjects(projectsList);
  const userRole = dbUser?.role ?? 'member';

  return (
    <TeamRegistry
      teams={teamsResult.teams}
      totalCount={teamsResult.totalCount}
      page={teamsResult.page}
      limit={teamsResult.limit}
      totalPages={teamsResult.totalPages}
      tab={status ?? 'active'}
      search={search}
      users={usersList}
      activeProjects={activeProjects}
      currentUserId={dbUser?.id}
      currentUserRole={userRole}
    />
  );
}
