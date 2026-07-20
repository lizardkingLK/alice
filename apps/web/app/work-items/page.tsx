import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import {
  getWorkItemsPaginated,
  type DbWorkItem,
} from '@/app/work-items/_services/workItem.server.service';
import { getUserList } from '@/app/users/_services/users.service.server';
import WorkItemsWorkspace from '@/app/work-items/_components/workItems-workspace';
import { getProjectList } from '@/app/projects/_services/projects.service.server';
import { parseStandardParams, type RawSearchParams } from '@/lib/search-params';

export default async function WorkItemsDashboard({
  searchParams,
}: Readonly<{
  searchParams: Promise<RawSearchParams>;
}>) {
  /** Custom RBAC: load role from application database once implemented. */

  const resolvedSearchParams = await searchParams;
  const { page, limit, search } = parseStandardParams(resolvedSearchParams, 10);

  const projects = await getProjectList();
  const projectMembers = await getUserList();

  let workItemsResult = {
    workItems: [] as DbWorkItem[],
    totalCount: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  try {
    workItemsResult = await getWorkItemsPaginated(page, limit, search);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('error. failed to fetch work items list via API:', message);
  }

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
