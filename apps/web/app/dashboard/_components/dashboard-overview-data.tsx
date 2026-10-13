import { DashboardChartsSlider } from '@/app/dashboard/_components/dashboard-charts-slider';
import { DashboardOverview } from '@/app/dashboard/_components/dashboard-overview';
import { getDashboardBurndownBootstrap } from '@/app/dashboard/_services/dashboard.reads.burndown.server';
import { listDashboardChartSlides } from '@/app/charts/_services/charts.reads.server';
import { getDbUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { EMPTY_ACTIVE_SPRINTS_PAGE } from '@/app/board/_services/board.reads.defaults.server';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.reads.server';
import type { RawSearchParams } from '@/lib/search-params';

function isMockOverviewFlag(value: string | string[] | undefined): boolean {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw === '1' || raw === 'true';
}

type DashboardOverviewDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

/** Async RSC — owns overview data so the shell can stream first. */
export async function DashboardOverviewData({
  searchParams,
}: Readonly<DashboardOverviewDataProps>) {
  const params = await searchParams;
  if (isMockOverviewFlag(params.mockOverview)) {
    const burndownBootstrap = await getDashboardBurndownBootstrap();
    return <DashboardOverview burndownBootstrap={burndownBootstrap} />;
  }

  const dbUser = await getDbUser();
  if (!dbUser) {
    return <DashboardChartsSlider slides={[]} />;
  }

  const [slides, projects, sprintsResult] = await Promise.all([
    safeServerFetch(
      listDashboardChartSlides(dbUser.id),
      [],
      'fetch dashboard chart slides'
    ),
    safeServerFetch(
      getAccessibleProjectList(dbUser.id),
      [],
      'fetch projects for dashboard slides'
    ),
    safeServerFetch(
      getSprintsPaginatedServer('active', 1, 100),
      EMPTY_ACTIVE_SPRINTS_PAGE,
      'fetch sprints for dashboard slides'
    ),
  ]);

  const activeProjects = filterActiveProjects(projects);
  const accessibleProjects = activeProjects.map((project) => ({
    id: project.id,
    name: project.name,
  }));
  const accessibleSprints = sprintsResult.sprints.flatMap((sprint) =>
    sprint.project?.id
      ? [
          {
            id: sprint.id,
            name: sprint.name,
            projectId: sprint.project.id,
          },
        ]
      : []
  );

  return (
    <DashboardChartsSlider
      slides={slides}
      accessibleProjects={accessibleProjects}
      accessibleSprints={accessibleSprints}
    />
  );
}
