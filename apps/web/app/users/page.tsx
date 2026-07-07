import { redirect } from 'next/navigation';
import { getDbUser, getUser } from '../../lib/auth';
import type { Tables } from '@repo/types';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { UserRegistry } from '@/app/users/_components/user-registry';
import { getUsersListPaginated } from '@/app/users/_services/users.service';

type DbUser = Tables<'users'>;

export default async function UsersDashboard({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ page?: string; limit?: string }>;
}>) {
  const resolvedSearchParams = await searchParams;
  const page = Number.parseInt(resolvedSearchParams.page ?? '1', 10);
  const limit = Number.parseInt(resolvedSearchParams.limit ?? '10', 10);

  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const dbUser = await getDbUser();
  const currentUserRole = dbUser?.role ?? 'member';

  let usersData = { users: [] as DbUser[], totalCount: 0, page: 1, limit: 10, totalPages: 1 };
  try {
    usersData = await getUsersListPaginated(page, limit);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('error. failed to fetch users list via API:', message);
  }

  return (
    <DashboardShell
      title="Users"
      description="Manage application users, assign workspace roles, and control access."
      user={user}
    >
      <div className="w-full">
        <UserRegistry
          users={usersData.users}
          totalCount={usersData.totalCount}
          page={usersData.page}
          limit={usersData.limit}
          totalPages={usersData.totalPages}
          currentUserId={user.id}
          currentUserRole={currentUserRole}
        />
      </div>
    </DashboardShell>
  );
}
