import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { SprintsWorkspace } from '@/app/sprints/_components/sprints-workspace';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.service.server';
import { getDbUser } from '@/lib/auth';

import { PaginatedSprints } from '@/app/sprints/_services/sprints.service';

export default async function SprintsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ page?: string; limit?: string; tab?: string; search?: string }>;
}>) {
  const resolvedSearchParams = await searchParams;
  const page = Number.parseInt(resolvedSearchParams.page ?? '1', 10);
  const limit = Number.parseInt(resolvedSearchParams.limit ?? '5', 10);
  const status =
    resolvedSearchParams.tab === 'archived' ? 'archived' : 'active';
  const search = resolvedSearchParams.search ?? '';

  const dbUser = await getDbUser();
  const userRole = dbUser?.role ?? 'member';

  let sprintsData: PaginatedSprints = {
    sprints: [],
    pagination: { page: 1, limit: 5, totalCount: 0, totalPages: 1 },
  };
  let fetchError: string | null = null;

  try {
    sprintsData = await getSprintsPaginatedServer(status, page, limit, search);
  } catch (error) {
    fetchError =
      error instanceof Error ? error.message : 'Failed to fetch sprints.';
    console.error('error. failed to fetch sprints list via API:', fetchError);
  }

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
