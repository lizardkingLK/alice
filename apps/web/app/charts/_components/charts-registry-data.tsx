import { ChartsRegistry } from '@/app/charts/_components/charts-registry';
import { listOwnedChartWorkspaces } from '@/app/charts/_services/charts.reads.server';
import { EMPTY_ACTIVE_SPRINTS_PAGE } from '@/app/board/_services/board.reads.defaults.server';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.reads.server';
import { getDbUser } from '@/lib/auth';
import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  parseChartsRegistryTab,
  parseStandardParams,
  type RawSearchParams,
} from '@/lib/search-params';
import { redirect } from 'next/navigation';

type ChartsRegistryDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

/**
 * Server shell for the charts registry. Prefetches owned workspaces and
 * resolves list filters from the URL (same pattern as Views).
 */
export async function ChartsRegistryData({
  searchParams,
}: Readonly<ChartsRegistryDataProps>) {
  const dbUser = await getDbUser();
  if (!dbUser) {
    redirect('/login');
  }

  const resolved = await searchParams;
  const { page, limit, search } = parseStandardParams(resolved, 10);
  const tab = parseChartsRegistryTab(resolved.tab);

  const [initialWorkspaces, projects, sprintsResult] = await Promise.all([
    safeServerFetch(
      listOwnedChartWorkspaces(dbUser.id),
      [],
      'fetch owned chart workspaces'
    ),
    safeServerFetch(
      getAccessibleProjectList(dbUser.id),
      [],
      'fetch projects for chart workspace create'
    ),
    safeServerFetch(
      getSprintsPaginatedServer('active', 1, 100),
      EMPTY_ACTIVE_SPRINTS_PAGE,
      'fetch sprints for chart workspace create'
    ),
  ]);

  const activeProjects = filterActiveProjects(projects);

  return (
    <ChartsRegistry
      currentUserId={dbUser.id}
      initialWorkspaces={initialWorkspaces}
      projects={activeProjects.map((project) => ({
        id: project.id,
        name: project.name,
      }))}
      sprints={sprintsResult.sprints.flatMap((sprint) =>
        sprint.project?.id
          ? [
              {
                id: sprint.id,
                name: sprint.name,
                projectId: sprint.project.id,
              },
            ]
          : []
      )}
      tab={tab}
      page={page}
      limit={limit}
      search={search}
    />
  );
}
