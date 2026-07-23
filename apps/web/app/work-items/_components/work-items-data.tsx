import WorkItemsWorkspace from '@/app/work-items/_components/workItems-workspace';
import {
  getWorkItemsPaginated,
  type DbWorkItem,
} from '@/app/work-items/_services/workItem.service.server';
import { getUserList } from '@/app/users/_services/users.service.server';
import { getProjectList } from '@/app/projects/_services/projects.service.server';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  parseStandardParams,
  parseWorkItemFilters,
  type RawSearchParams,
} from '@/lib/search-params';

const EMPTY_WORK_ITEMS = {
  workItems: [] as DbWorkItem[],
  totalCount: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

type WorkItemsDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

export async function WorkItemsData({
  searchParams,
}: Readonly<WorkItemsDataProps>) {
  const resolvedSearchParams = await searchParams;
  const { page, limit, search } = parseStandardParams(resolvedSearchParams, 10);
  const { projectId, type, assigneeId } =
    parseWorkItemFilters(resolvedSearchParams);

  const [projects, projectMembers, workItemsResult] = await Promise.all([
    safeServerFetch(getProjectList(), [], 'fetch projects for work items'),
    safeServerFetch(getUserList(), [], 'fetch users for work items'),
    safeServerFetch(
      getWorkItemsPaginated(page, limit, search, {
        projectId,
        type,
        assigneeId,
      }),
      EMPTY_WORK_ITEMS,
      'fetch work items list'
    ),
  ]);

  return (
    <WorkItemsWorkspace
      projects={projects}
      projectMembers={projectMembers}
      initialWorkItems={workItemsResult.workItems}
      totalCount={workItemsResult.totalCount}
      page={workItemsResult.page}
      limit={workItemsResult.limit}
      totalPages={workItemsResult.totalPages}
      search={search}
      projectFilter={projectId ?? ''}
      typeFilter={type ?? ''}
      assigneeFilter={assigneeId ?? ''}
    />
  );
}
