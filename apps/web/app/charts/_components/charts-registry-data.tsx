import { ChartsRegistry } from '@/app/charts/_components/charts-registry';
import { getDbUser } from '@/lib/auth';
import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  parseStandardParams,
  parseViewsListTab,
  type RawSearchParams,
} from '@/lib/search-params';
import { redirect } from 'next/navigation';

type ChartsRegistryDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

export async function ChartsRegistryData({
  searchParams,
}: Readonly<ChartsRegistryDataProps>) {
  const dbUser = await getDbUser();
  if (!dbUser) {
    redirect('/login');
  }

  const resolved = await searchParams;
  const { page, limit, search } = parseStandardParams(resolved, 10);
  const tab = parseViewsListTab(resolved.tab);

  const projects = await safeServerFetch(
    getAccessibleProjectList(dbUser.id),
    [],
    'fetch projects for chart share dialog'
  );
  const shareProjects = filterActiveProjects(projects).map((project) => ({
    id: project.id,
    name: project.name,
  }));

  return (
    <ChartsRegistry
      currentUserId={dbUser.id}
      tab={tab}
      search={search}
      page={page}
      limit={limit}
      shareProjects={shareProjects}
    />
  );
}
