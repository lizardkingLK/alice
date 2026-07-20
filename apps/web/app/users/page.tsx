import { getDbUser } from '../../lib/auth';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { parseStandardParams, type RawSearchParams } from '@/lib/search-params';
import { UserRegistry } from '@/app/users/_components/user-registry';
import {
  getUsersListPaginated,
  type User,
} from '@/app/users/_services/users.service.server';

export default async function UsersDashboard({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  const resolvedSearchParams = await searchParams;
  const { page, limit } = parseStandardParams(resolvedSearchParams, 10);

  const dbUser = await getDbUser();
  const currentUserRole = dbUser?.role ?? 'member';

  let usersData = {
    users: [] as User[],
    totalCount: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  try {
    usersData = await getUsersListPaginated(page, limit);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('error. failed to fetch users list via API:', message);
  }

  return (
    <DashboardShell description="Manage application users, assign workspace roles, and control access.">
      <UserRegistry
        users={usersData.users}
        totalCount={usersData.totalCount}
        page={usersData.page}
        limit={usersData.limit}
        totalPages={usersData.totalPages}
        currentUserId={dbUser?.id}
        currentUserRole={currentUserRole}
      />
    </DashboardShell>
  );
}
