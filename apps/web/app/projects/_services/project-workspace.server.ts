import { getDbUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';
import {
  parseStandardParams,
  parseWorkItemFilters,
  type RawSearchParams,
} from '@/lib/search-params';
import { getUserList } from '@/app/users/_services/users.service.server';
import {
  getWorkItemsPaginated,
  type DbWorkItem,
} from '@/app/work-items/_services/workItem.service.server';
import {
  getProjectDetails,
  getProjectMembers,
  type Project,
  type ProjectMemberWithUser,
} from './projects.service.server';

const EMPTY_WORK_ITEMS = {
  workItems: [] as DbWorkItem[],
  totalCount: 0,
  page: 1,
  limit: 10,
  totalPages: 1,
};

export type ProjectWorkspaceData = {
  project: Project;
  members: ProjectMemberWithUser[];
  allUsers: Awaited<ReturnType<typeof getUserList>>;
  currentUserId?: string | null;
  currentUserRole: string;
  workItems: {
    initialWorkItems: DbWorkItem[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
    search: string;
    typeFilter: string;
    assigneeFilter: string;
  };
};

/**
 * M4.2 — single RSC loader for the project detail surface
 * (details + members + users dropdown + project work items).
 */
export async function getProjectWorkspace(
  projectId: string,
  searchParams: RawSearchParams
): Promise<ProjectWorkspaceData | null> {
  const { page, limit, search } = parseStandardParams(searchParams, 10);
  const { type, assigneeId } = parseWorkItemFilters(searchParams);

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
    return null;
  }

  const [project, members] = projectBundle;

  return {
    project,
    members,
    allUsers,
    currentUserId: dbUser?.id,
    currentUserRole: dbUser?.role ?? 'member',
    workItems: {
      initialWorkItems: workItemsResult.workItems,
      totalCount: workItemsResult.totalCount,
      page: workItemsResult.page,
      limit: workItemsResult.limit,
      totalPages: workItemsResult.totalPages,
      search,
      typeFilter: type ?? '',
      assigneeFilter: assigneeId ?? '',
    },
  };
}
