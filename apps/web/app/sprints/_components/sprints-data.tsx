import { getDbUser } from '@/lib/auth';
import { SprintsWorkspace } from '@/app/sprints/_components/sprints-workspace';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.reads.server';
import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  parseStandardParams,
  parseTabStatus,
  type RawSearchParams,
} from '@/lib/search-params';
import type { PaginatedSprints } from '@/app/sprints/_services/sprints.mutations.client';

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

  const dbUser = await getDbUser();
  const [sprintsData, projects] = await Promise.all([
    getSprintsPaginatedServer(status, page, limit, search).catch(
      (error: unknown) => {
        fetchError =
          error instanceof Error ? error.message : 'Failed to fetch sprints.';
        console.error('error. failed to fetch sprints list:', fetchError);
        return EMPTY_SPRINTS;
      }
    ),
    dbUser
      ? safeServerFetch(
          getAccessibleProjectList(dbUser.id),
          [],
          'fetch projects for sprint form'
        )
      : Promise.resolve([]),
  ]);

  const userRole = dbUser?.role ?? 'member';

  return (
    <SprintsWorkspace
      sprints={sprintsData.sprints}
      pagination={sprintsData.pagination}
      projects={filterActiveProjects(projects)}
      filterTab={status}
      search={search}
      userRole={userRole}
      currentUserId={dbUser?.id}
      error={fetchError}
    />
  );
}
