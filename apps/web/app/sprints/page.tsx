import { redirect } from 'next/navigation';
import { getUser } from '@/lib/auth';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { SprintsWorkspace } from '@/app/sprints/_components/sprints-workspace';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.service.server';

import { PaginatedSprints } from '@/app/sprints/_services/sprints.service';

export default async function SprintsPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ page?: string; limit?: string; tab?: string }>;
}>) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const resolvedSearchParams = await searchParams;
  const page = Number.parseInt(resolvedSearchParams.page ?? '1', 10);
  const limit = Number.parseInt(resolvedSearchParams.limit ?? '5', 10);
  const status =
    resolvedSearchParams.tab === 'archived' ? 'archived' : 'active';

  let sprintsData: PaginatedSprints = {
    sprints: [],
    pagination: { page: 1, limit: 5, totalCount: 0, totalPages: 1 },
  };
  let fetchError: string | null = null;

  try {
    sprintsData = await getSprintsPaginatedServer(status, page, limit);
  } catch (error) {
    fetchError =
      error instanceof Error ? error.message : 'Failed to fetch sprints.';
    console.error('error. failed to fetch sprints list via API:', fetchError);
  }

  return (
    <DashboardShell
      title="Sprints"
      description="Plan and track team sprints."
      user={user}
    >
      <SprintsWorkspace
        sprints={sprintsData.sprints}
        pagination={sprintsData.pagination}
        filterTab={status}
        error={fetchError}
      />
    </DashboardShell>
  );
}
