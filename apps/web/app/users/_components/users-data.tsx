import { getDbUser } from '@/lib/auth';
import { UserRegistry } from '@/app/users/_components/user-registry';
import {
  getUsersListPaginated,
  type User,
} from '@/app/users/_services/users.service.server';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { parseStandardParams, type RawSearchParams } from '@/lib/search-params';

const EMPTY_USERS = {
  users: [] as User[],
  totalCount: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

type UsersDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

export async function UsersData({ searchParams }: Readonly<UsersDataProps>) {
  const resolvedSearchParams = await searchParams;
  const { page, limit, search } = parseStandardParams(resolvedSearchParams, 10);

  const [dbUser, usersData] = await Promise.all([
    getDbUser(),
    safeServerFetch(
      getUsersListPaginated(page, limit, search),
      EMPTY_USERS,
      'fetch users list'
    ),
  ]);

  const currentUserRole = dbUser?.role ?? 'member';

  return (
    <UserRegistry
      users={usersData.users}
      totalCount={usersData.totalCount}
      page={usersData.page}
      limit={usersData.limit}
      totalPages={usersData.totalPages}
      search={search}
      currentUserId={dbUser?.id}
      currentUserRole={currentUserRole}
    />
  );
}
