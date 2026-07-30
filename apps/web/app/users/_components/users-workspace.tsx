'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/ui/components/ui/tabs';
import { Shield, Users } from '@repo/ui/lib/icons';
import { UserRegistry } from '@/app/users/_components/user-registry';
import { AccessAllowlistRegistry } from '@/app/access-allowlist/_components/access-allowlist-registry';
import type { User } from '@/app/users/_services/users.service';
import type { AccessAllowlistEntry } from '@/app/access-allowlist/_services/accessAllowlist.service';
import { parseUsersPageTab, type UsersPageTab } from '@/lib/search-params';
import { UNDERLINE_TAB_TRIGGER_CLASS } from '@/components/underline-tab-trigger';

interface UsersWorkspaceProps {
  readonly users: User[];
  readonly totalCount: number;
  readonly page: number;
  readonly limit: number;
  readonly totalPages: number;
  readonly search: string;
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
  readonly allowlistEntries: AccessAllowlistEntry[];
  readonly allowlistTotalCount: number;
  readonly allowlistPage: number;
  readonly allowlistLimit: number;
  readonly allowlistTotalPages: number;
}

export function UsersWorkspace({
  users,
  totalCount,
  page,
  limit,
  totalPages,
  search,
  currentUserId,
  currentUserRole,
  allowlistEntries,
  allowlistTotalCount,
  allowlistPage,
  allowlistLimit,
  allowlistTotalPages,
}: Readonly<UsersWorkspaceProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAdmin = currentUserRole === 'admin';
  const requestedTab = parseUsersPageTab(searchParams.get('tab'));
  const activeTab: UsersPageTab =
    isAdmin && requestedTab === 'allowlist' ? 'allowlist' : 'users';

  const handleTabChange = (value: string) => {
    const nextTab = value as UsersPageTab;
    const params = new URLSearchParams(searchParams.toString());
    if (nextTab === 'users') {
      params.delete('tab');
    } else {
      params.set('tab', nextTab);
    }
    // Reset list filters when switching panels.
    params.delete('page');
    params.delete('search');
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  if (!isAdmin) {
    return (
      <UserRegistry
        users={users}
        totalCount={totalCount}
        page={page}
        limit={limit}
        totalPages={totalPages}
        search={search}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
      />
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={handleTabChange}
      className="w-full space-y-6"
    >
      <TabsList className="border-border flex h-auto justify-start gap-4 rounded-none border-b bg-transparent p-0">
        <TabsTrigger value="users" className={UNDERLINE_TAB_TRIGGER_CLASS}>
          <Users className="h-4 w-4" />
          Users
        </TabsTrigger>
        <TabsTrigger value="allowlist" className={UNDERLINE_TAB_TRIGGER_CLASS}>
          <Shield className="h-4 w-4" />
          Access allowlist
        </TabsTrigger>
      </TabsList>

      <TabsContent
        value="users"
        className="m-0 focus-visible:ring-0 focus-visible:ring-offset-0"
      >
        <UserRegistry
          users={users}
          totalCount={totalCount}
          page={page}
          limit={limit}
          totalPages={totalPages}
          search={search}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
        />
      </TabsContent>

      <TabsContent
        value="allowlist"
        className="m-0 focus-visible:ring-0 focus-visible:ring-offset-0"
      >
        <AccessAllowlistRegistry
          entries={allowlistEntries}
          totalCount={allowlistTotalCount}
          page={allowlistPage}
          limit={allowlistLimit}
          totalPages={allowlistTotalPages}
          search={search}
        />
      </TabsContent>
    </Tabs>
  );
}
