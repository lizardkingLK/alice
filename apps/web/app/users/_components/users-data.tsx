import { getDbUser } from '@/lib/auth';
import { UsersWorkspace } from '@/app/users/_components/users-workspace';
import {
  getUsersListPaginated,
  type User,
} from '@/app/users/_services/users.service.server';
import { listAccessAllowlist } from '@/app/access-allowlist/_services/accessAllowlist.service.server';
import type { AccessAllowlistEntry } from '@/app/access-allowlist/_services/accessAllowlist.service.base';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { parseStandardParams, type RawSearchParams } from '@/lib/search-params';

const EMPTY_USERS = {
  users: [] as User[],
  totalCount: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

const EMPTY_ALLOWLIST: AccessAllowlistEntry[] = [];

type UsersDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

export async function UsersData({ searchParams }: Readonly<UsersDataProps>) {
  const resolvedSearchParams = await searchParams;
  const { page, limit, search } = parseStandardParams(resolvedSearchParams, 10);

  const dbUser = await getDbUser();
  const currentUserRole = dbUser?.role ?? 'member';
  const isAdmin = currentUserRole === 'admin';

  const [usersData, allowlistEntries] = await Promise.all([
    safeServerFetch(
      getUsersListPaginated(page, limit, search),
      EMPTY_USERS,
      'fetch users list'
    ),
    isAdmin
      ? safeServerFetch(
          listAccessAllowlist('all'),
          EMPTY_ALLOWLIST,
          'fetch access allowlist'
        )
      : Promise.resolve(EMPTY_ALLOWLIST),
  ]);

  return (
    <UsersWorkspace
      users={usersData.users}
      totalCount={usersData.totalCount}
      page={usersData.page}
      limit={usersData.limit}
      totalPages={usersData.totalPages}
      search={search}
      currentUserId={dbUser?.id}
      currentUserRole={currentUserRole}
      allowlistEntries={allowlistEntries}
    />
  );
}
