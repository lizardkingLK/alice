import { notFound } from 'next/navigation';
import { getDbUser } from '@/lib/auth';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import {
  getProjectDetails,
  getProjectMembers,
  type Project,
  type ProjectMemberWithUser,
} from '../_services/projects.service.server';
import { getUserList } from '@/app/users/_services/users.service.server';
import {
  getWorkItemsPaginated,
  type DbWorkItem,
} from '@/app/work-items/_services/workItem.service.server';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  parseStandardParams,
  parseWorkItemFilters,
  type RawSearchParams,
} from '@/lib/search-params';
import { ProjectDetailsWorkspace } from './_components/project-details-workspace';

const EMPTY_WORK_ITEMS = {
  workItems: [] as DbWorkItem[],
  totalCount: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

export default async function ProjectDetailsPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}>) {
  const resolvedParams = await params;
  const projectId = resolvedParams.id;
  const resolvedSearchParams = await searchParams;
  const { page, limit, search } = parseStandardParams(resolvedSearchParams, 10);
  const { type, assigneeId } = parseWorkItemFilters(resolvedSearchParams);

  const [dbUser, projectBundle, allUsers, workItemsResult] = await Promise.all([
    getDbUser(),
    safeServerFetch<[Project, ProjectMemberWithUser[]] | null>(
      Promise.all([getProjectDetails(projectId), getProjectMembers(projectId)]),
      null,
      'load project details'
    ),
    safeServerFetch(getUserList(), [], 'fetch users for project members'),
    safeServerFetch(
      getWorkItemsPaginated(page, limit, search, {
        projectId,
        type,
        assigneeId,
      }),
      EMPTY_WORK_ITEMS,
      'fetch project work items'
    ),
  ]);

  if (!projectBundle) {
    notFound();
  }

  const [project, members] = projectBundle;
  const userRole = dbUser?.role ?? 'member';

  return (
    <DashboardShell
      description={`Workspace configurations for ${project.name}`}
    >
      <div className="w-full">
        <ProjectDetailsWorkspace
          project={project}
          members={members}
          allUsers={allUsers}
          currentUserId={dbUser?.id}
          currentUserRole={userRole}
          workItems={{
            initialWorkItems: workItemsResult.workItems,
            totalCount: workItemsResult.totalCount,
            page: workItemsResult.page,
            limit: workItemsResult.limit,
            totalPages: workItemsResult.totalPages,
            search,
            typeFilter: type ?? '',
            assigneeFilter: assigneeId ?? '',
          }}
        />
      </div>
    </DashboardShell>
  );
}
