import { redirect } from 'next/navigation';
import { getUser, getDbUser } from '@/lib/auth';
import { TeamRegistry } from './_components/team-registry';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import {
  getTeamListPaginated,
  type Team,
} from './_services/teams.service.server';
import { getUserList } from '@/app/users/_services/users.service.server';

export default async function ManagerDashboardPage({
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

  // Map tab selections to DB statuses. Default to 'active'.
  let status: 'active' | 'inactive' | 'archived' | undefined = 'active';
  if (resolvedSearchParams.tab === 'archived') {
    status = 'archived';
  } else if (resolvedSearchParams.tab === 'inactive') {
    status = 'inactive';
  }

  const search = resolvedSearchParams.search ?? '';

  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

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
    <DashboardShell
      title="Team"
      description="Manage teams workload and engineering resources."
      user={user}
    >
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
