import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import {
  getWorkItemsPaginated,
  type DbWorkItem,
} from '@/app/work-items/_services/workItem.service.server';
import { getUserList } from '@/app/users/_services/users.service.server';
import WorkItemsWorkspace from '@/app/work-items/_components/workItems-workspace';
import { getProjectList } from '@/app/projects/_services/projects.service.server';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import { parseStandardParams, type RawSearchParams } from '@/lib/search-params';

const EMPTY_WORK_ITEMS = {
  workItems: [] as DbWorkItem[],
  totalCount: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

export default async function WorkItemsDashboard({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  /** Custom RBAC: load role from application database once implemented. */

  const resolvedSearchParams = await searchParams;
  const { page, limit, search } = parseStandardParams(resolvedSearchParams, 10);

  const [projects, projectMembers, workItemsResult] = await Promise.all([
    safeServerFetch(getProjectList(), [], 'fetch projects via API'),
    safeServerFetch(getUserList(), [], 'fetch users via API'),
    safeServerFetch(
      getWorkItemsPaginated(page, limit, search),
      EMPTY_WORK_ITEMS,
      'fetch work items list via API'
    ),
  ]);

  return (
    <DashboardShell description="Manage Work Items.">
      <WorkItemsWorkspace
        projects={projects}
        projectMembers={projectMembers}
        initialWorkItems={workItemsResult.workItems}
        totalCount={workItemsResult.totalCount}
        page={workItemsResult.page}
        limit={workItemsResult.limit}
        totalPages={workItemsResult.totalPages}
        search={search}
      />
    </DashboardShell>
  );
}
