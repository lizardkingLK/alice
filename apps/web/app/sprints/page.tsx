import { Metadata } from 'next';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { SprintsWorkspace } from '@/app/sprints/_components/sprints-workspace';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.service.server';
import {
  parseStandardParams,
  parseTabStatus,
  type RawSearchParams,
} from '@/lib/search-params';
import { getDbUser } from '@/lib/auth';

import { PaginatedSprints } from '@/app/sprints/_services/sprints.service';

export const metadata: Metadata = {
  title: 'Sprints',
  robots: {
    index: false,
    follow: false,
  },
};

const EMPTY_SPRINTS: PaginatedSprints = {
  sprints: [],
  pagination: { page: 1, limit: 5, totalCount: 0, totalPages: 1 },
};

export default async function SprintsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  const resolvedSearchParams = await searchParams;
  const { page, limit, search } = parseStandardParams(resolvedSearchParams, 5);
  const status = parseTabStatus(resolvedSearchParams.tab);

  let fetchError: string | null = null;

  const [dbUser, sprintsData] = await Promise.all([
    getDbUser(),
    getSprintsPaginatedServer(status, page, limit, search).catch(
      (error: unknown) => {
        fetchError =
          error instanceof Error ? error.message : 'Failed to fetch sprints.';
        console.error(
          'error. failed to fetch sprints list via API:',
          fetchError
        );
        return EMPTY_SPRINTS;
      }
    ),
  ]);

  const userRole = dbUser?.role ?? 'member';

  return (
    <DashboardShell description="Plan and track team sprints.">
      <SprintsWorkspace
        sprints={sprintsData.sprints}
        pagination={sprintsData.pagination}
        filterTab={status}
        search={search}
        userRole={userRole}
        currentUserId={dbUser?.id}
        error={fetchError}
      />
    </DashboardShell>
  );
}
