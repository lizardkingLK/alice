import { getDbUser } from '../../lib/auth';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { parseStandardParams, type RawSearchParams } from '@/lib/search-params';
import { UserRegistry } from '@/app/users/_components/user-registry';
import {
  getUsersListPaginated,
  type User,
} from '@/app/users/_services/users.service.server';

const EMPTY_USERS = {
  users: [] as User[],
  totalCount: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

export default async function UsersDashboard({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  const resolvedSearchParams = await searchParams;
  const { page, limit } = parseStandardParams(resolvedSearchParams, 10);

  const [dbUser, usersData] = await Promise.all([
    getDbUser(),
    getUsersListPaginated(page, limit).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('error. failed to fetch users list via API:', message);
      return EMPTY_USERS;
    }),
  ]);

  const currentUserRole = dbUser?.role ?? 'member';

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
