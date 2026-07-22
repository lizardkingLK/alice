import { getDbUser } from '@/lib/auth';
import { SprintsWorkspace } from '@/app/sprints/_components/sprints-workspace';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.service.server';
import { getProjectList } from '@/app/projects/_services/projects.service.server';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  parseStandardParams,
  parseTabStatus,
  type RawSearchParams,
} from '@/lib/search-params';
import type { PaginatedSprints } from '@/app/sprints/_services/sprints.service';

const EMPTY_SPRINTS: PaginatedSprints = {
  sprints: [],
  pagination: { page: 1, limit: 5, totalCount: 0, totalPages: 1 },
};

type SprintsDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

export async function SprintsData({
  searchParams,
}: Readonly<SprintsDataProps>) {
  const resolvedSearchParams = await searchParams;
  const { page, limit, search } = parseStandardParams(resolvedSearchParams, 5);
  const status = parseTabStatus(resolvedSearchParams.tab);

  let fetchError: string | null = null;

  const [dbUser, sprintsData, projects] = await Promise.all([
    getDbUser(),
    getSprintsPaginatedServer(status, page, limit, search).catch(
      (error: unknown) => {
        fetchError =
          error instanceof Error ? error.message : 'Failed to fetch sprints.';
        console.error('error. failed to fetch sprints list:', fetchError);
        return EMPTY_SPRINTS;
      }
    ),
    safeServerFetch(getProjectList(), [], 'fetch projects for sprint form'),
  ]);

  const userRole = dbUser?.role ?? 'member';

  return (
    <SprintsWorkspace
      sprints={sprintsData.sprints}
      pagination={sprintsData.pagination}
      projects={projects}
      filterTab={status}
      search={search}
      userRole={userRole}
      currentUserId={dbUser?.id}
      error={fetchError}
    />
  );
}
