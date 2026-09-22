import { getDbUser } from '@/lib/auth';
import { TeamRegistry } from '@/app/manager/_components/team-registry';
import {
  getTeamListPaginated,
  type Team,
} from '@/app/manager/_services/teams.reads.server';
import { getUserList } from '@/app/users/_services/users.reads.server';
import { getProjectMembersByProjectIds } from '@/app/projects/_services/projects.reads.server';
import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
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

  const dbUser = await getDbUser();
  const [usersList, teamsResult, projectsList] = await Promise.all([
    safeServerFetch(getUserList(), [], 'fetch users for team form'),
    safeServerFetch(
      getTeamListPaginated(page, limit, status, search),
      EMPTY_TEAMS,
      'fetch teams list'
    ),
    dbUser
      ? safeServerFetch(
          getAccessibleProjectList(dbUser.id),
          [],
          'fetch projects for team form'
        )
      : Promise.resolve([]),
  ]);

  const activeProjects = filterActiveProjects(projectsList);
  const projectIdsForMembers = [
    ...new Set([
      ...activeProjects.map((project) => project.id),
      ...teamsResult.teams
        .map((team) => team.project_id)
        .filter((projectId): projectId is string => Boolean(projectId)),
    ]),
  ];
  const projectMembersByProjectId = await safeServerFetch(
    getProjectMembersByProjectIds(projectIdsForMembers),
    {},
    'fetch project members for team form'
  );
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
      projectMembersByProjectId={projectMembersByProjectId}
      currentUserId={dbUser?.id}
      currentUserRole={userRole}
    />
  );
}
