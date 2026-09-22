import { ChartsRegistry } from '@/app/charts/_components/charts-registry';
import { listOwnedChartWorkspaces } from '@/app/charts/_services/charts.reads.server';
import { getDbUser } from '@/lib/auth';
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

  const initialWorkspaces = await safeServerFetch(
    listOwnedChartWorkspaces(dbUser.id),
    [],
    'fetch owned chart workspaces'
  );

  return (
    <ChartsRegistry
      currentUserId={dbUser.id}
      initialWorkspaces={initialWorkspaces}
      tab={tab}
      page={page}
      limit={limit}
      search={search}
    />
  );
}
