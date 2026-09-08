import type { RawSearchParams } from '@/lib/search-params';
import { ChartsWorkspace } from '@/app/charts/_components/charts-workspace';
import type {
  ChartBoardOwnershipFilter,
  ChartBoardStatusFilter,
} from '@/app/charts/_components/charts.types';

type ChartsDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

/** UI-first stub — board layout persists locally until API boards land. */
export async function ChartsData({ searchParams }: Readonly<ChartsDataProps>) {
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

  return (
    <ChartsWorkspace
      search={search}
      ownership={workspaceOwnership}
      status={workspaceStatus}
    />
  );
}
