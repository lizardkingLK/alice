import { getDbUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  parseStandardParams,
  parseViewsListTab,
  type RawSearchParams,
} from '@/lib/search-params';
import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
import { ViewsWorkspace } from '@/app/views/_components/views-workspace';
import {
  getSavedViewsPaginated,
  type SavedView,
} from '@/app/views/_services/saved-views.reads.server';

const EMPTY_VIEWS = {
  views: [] as SavedView[],
  totalCount: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

type ViewsDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

export async function ViewsData({ searchParams }: Readonly<ViewsDataProps>) {
  const resolved = await searchParams;
  const { page, limit, search } = parseStandardParams(resolved, 10);
  const tab = parseViewsListTab(resolved.tab);
  const dbUser = await getDbUser();

  const [viewsResult, projects] = await Promise.all([
    safeServerFetch(
      getSavedViewsPaginated(page, limit, tab, search),
      EMPTY_VIEWS,
      'fetch saved views list'
    ),
    dbUser
      ? safeServerFetch(
          getAccessibleProjectList(dbUser.id),
          [],
          'fetch projects for share dialog'
        )
      : Promise.resolve([]),
  ]);

  const shareProjects = projects
    .filter((project) => project.status !== 'archived')
    .map((project) => ({
      id: project.id,
      name: project.name,
    }));

  return (
    <ViewsWorkspace
      views={viewsResult.views}
      totalCount={viewsResult.totalCount}
      page={viewsResult.page}
      limit={viewsResult.limit}
      totalPages={viewsResult.totalPages}
      tab={tab}
      search={search}
      currentUserId={dbUser?.id ?? null}
      shareProjects={shareProjects}
    />
  );
}
