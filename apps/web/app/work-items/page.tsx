import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import {
  getWorkItemsPaginated,
  type DbWorkItem,
} from '@/app/work-items/_services/workItem.service.server';
import { getUserList } from '@/app/users/_services/users.service.server';
import WorkItemsWorkspace from '@/app/work-items/_components/workItems-workspace';
import { getProjectList } from '@/app/projects/_services/projects.service.server';
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
    getProjectList().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('error. failed to fetch projects via API:', message);
      return [];
    }),
    getUserList().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('error. failed to fetch users via API:', message);
      return [];
    }),
    getWorkItemsPaginated(page, limit, search).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('error. failed to fetch work items list via API:', message);
      return EMPTY_WORK_ITEMS;
    }),
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
