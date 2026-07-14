import { getDbUser } from '@/lib/auth';
import { TeamRegistry } from './_components/team-registry';
import {
  parseStandardParams,
  parseManagerTabStatus,
  type RawSearchParams,
} from '@/lib/search-params';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import {
  getTeamListPaginated,
  type Team,
} from './_services/teams.service.server';
import { getUserList } from '@/app/users/_services/users.service.server';

export default async function ManagerDashboardPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  const resolvedSearchParams = await searchParams;
  const { page, limit, search } = parseStandardParams(resolvedSearchParams, 10);
  const status = parseManagerTabStatus(resolvedSearchParams.tab);

  const dbUser = await getDbUser();
  const userRole = dbUser?.role ?? 'member';

  // Fetch all active users to populate the Team Manager choices
  const usersList = (await getUserList()) ?? [];

  let teamsResult = {
    teams: [] as Team[],
    totalCount: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  };
  try {
    teamsResult = await getTeamListPaginated(page, limit, status, search);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('error. failed to fetch teams list via API:', message);
  }

  return (
    <DashboardShell description="Manage teams workload and engineering resources.">
      <TeamRegistry
        teams={teamsResult.teams}
        totalCount={teamsResult.totalCount}
        page={teamsResult.page}
        limit={teamsResult.limit}
        totalPages={teamsResult.totalPages}
        tab={status ?? 'active'}
        search={search}
        users={usersList}
        currentUserId={dbUser?.id}
        currentUserRole={userRole}
      />
    </DashboardShell>
  );
}
