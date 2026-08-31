import { getDbUser } from '@/lib/auth';
import { isAdmin } from '@/lib/rbac/roles';
import { UsersWorkspace } from '@/app/users/_components/users-workspace';
import {
  getUsersListPaginated,
  type User,
} from '@/app/users/_services/users.reads.server';
import { listAccessAllowlist } from '@/app/access-allowlist/_services/access-allowlist.reads.server';
import type { AccessAllowlistListResult } from '@/app/access-allowlist/_services/access-allowlist.mutations.shared';
import { getProjectList } from '@/app/projects/_services/projects.reads.server';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  listParamsForUsersPageTab,
  parseStandardParams,
  parseUsersPageTab,
  type RawSearchParams,
} from '@/lib/search-params';

const EMPTY_USERS = {
  users: [] as User[],
  totalCount: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

const EMPTY_ALLOWLIST: AccessAllowlistListResult = {
  items: [],
  totalCount: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

const EMPTY_PROJECTS: Project[] = [];

type UsersDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

export async function UsersData({ searchParams }: Readonly<UsersDataProps>) {
  const resolvedSearchParams = await searchParams;
  const parsed = parseStandardParams(resolvedSearchParams, 10);
  const activeTab = parseUsersPageTab(resolvedSearchParams.tab);
  const usersParams = listParamsForUsersPageTab(parsed, activeTab, 'users');
  const allowlistParams = listParamsForUsersPageTab(
    parsed,
    activeTab,
    'allowlist'
  );

  const dbUser = await getDbUser();
  const currentUserRole = dbUser?.role ?? 'member';
  const allowlistEnabled = isAdmin(currentUserRole);

  const [usersData, allowlistData, projects] = await Promise.all([
    safeServerFetch(
      getUsersListPaginated(
        usersParams.page,
        usersParams.limit,
        usersParams.search
      ),
      EMPTY_USERS,
      'fetch users list'
    ),
    allowlistEnabled
      ? safeServerFetch(
          listAccessAllowlist({
            status: 'all',
            page: allowlistParams.page,
            limit: allowlistParams.limit,
            search: allowlistParams.search,
          }),
          EMPTY_ALLOWLIST,
          'fetch access allowlist'
        )
      : Promise.resolve(EMPTY_ALLOWLIST),
    allowlistEnabled
      ? safeServerFetch(
          getProjectList(),
          EMPTY_PROJECTS,
          'fetch projects for allowlist form'
        )
      : Promise.resolve(EMPTY_PROJECTS),
  ]);

  return (
    <UsersWorkspace
      users={usersData.users}
      totalCount={usersData.totalCount}
      page={usersData.page}
      limit={usersData.limit}
      totalPages={usersData.totalPages}
      search={parsed.search}
      currentUserId={dbUser?.id}
      currentUserRole={currentUserRole}
      allowlistEntries={allowlistData.items}
      allowlistTotalCount={allowlistData.totalCount}
      allowlistPage={allowlistData.page}
      allowlistLimit={allowlistData.limit}
      allowlistTotalPages={allowlistData.totalPages}
      currentUserEmail={dbUser?.email}
      projects={projects}
    />
  );
}
