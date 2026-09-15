import type { RawSearchParams } from '@/lib/search-params';
import { getDbUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
import { ChartsWorkspace } from '@/app/charts/_components/charts-workspace';
import type {
  ChartBoardOwnershipFilter,
  ChartBoardStatusFilter,
} from '@/app/charts/_components/charts.types';

type ChartsDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
  readonly workspaceId: string;
  readonly currentUserId: string;
  readonly focusWidgetId?: string;
};

export async function ChartsData({
  searchParams,
  workspaceId,
  currentUserId,
  focusWidgetId,
}: Readonly<ChartsDataProps>) {
  const resolved = await searchParams;
  const search =
    typeof resolved.search === 'string' ? resolved.search.trim() : '';

  const ownership =
    typeof resolved.ownership === 'string' ? resolved.ownership : 'all';
  let workspaceOwnership: ChartBoardOwnershipFilter = 'all';
  if (ownership === 'mine' || ownership === 'shared') {
    workspaceOwnership = ownership;
  }

  const status = typeof resolved.status === 'string' ? resolved.status : 'all';
  let workspaceStatus: ChartBoardStatusFilter = 'all';
  if (status === 'archived') {
    workspaceStatus = 'archived';
  } else if (status === 'active') {
    workspaceStatus = 'active';
  }

  const dbUser = await getDbUser();
  const projects = dbUser
    ? await safeServerFetch(
        getAccessibleProjectList(dbUser.id),
        [],
        'fetch projects for chart share dialog'
      )
    : [];
  const shareProjects = projects
    .filter((project) => project.status !== 'archived')
    .map((project) => ({
      id: project.id,
      name: project.name,
    }));

  return (
    <ChartsWorkspace
      workspaceId={workspaceId}
      currentUserId={currentUserId}
      focusWidgetId={focusWidgetId}
      search={search}
      ownership={workspaceOwnership}
      status={workspaceStatus}
      shareProjects={shareProjects}
    />
  );
}
