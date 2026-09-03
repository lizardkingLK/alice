import type { Project as DbProject } from '@/app/projects/_services/projects.mutations.client';
import {
  EMPTY_ACTIVE_SPRINTS_PAGE,
  getSuggestedBoardDefaults,
} from '@/app/board/_services/board.reads.defaults.server';
import { getProjectList } from '@/app/projects/_services/projects.reads.server';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import { getSprintsPaginatedServer } from '@/app/sprints/_services/sprints.reads.server';
import type { User as DbUser } from '@/app/users/_services/users.mutations.client';
import { getUserList } from '@/app/users/_services/users.reads.server';
import {
  getWorkItems,
  type DbWorkItem,
} from '@/app/work-items/_services/work-items.reads.server';
import { getDbUser } from '@/lib/auth';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { listAccessibleProjectIds } from '@/lib/projects/project-workspace-access';
import { safeServerFetch } from '@/lib/safe-server-fetch';

export type BacklogWorkspaceData = {
  projects: DbProject[];
  projectMembers: DbUser[];
  initialWorkItems: DbWorkItem[];
  sprints: Sprint[];
  userRole: string;
  currentUserId?: string | null;
  suggestedDefaults: BoardDefaultsPreference | null;
  error: string | null;
};

/** M4.1 — single RSC loader for the backlog planning surface (4 parallel reads). */
export async function getBacklogWorkspace(): Promise<BacklogWorkspaceData> {
  let fetchError: string | null = null;

  const dbUser = await getDbUser();
  const userRole = dbUser?.role ?? 'member';

  const accessibleProjects = dbUser
    ? await listAccessibleProjectIds(dbUser.id, dbUser.role)
    : [];

  let initialWorkItemsFilters:
    | { projectIds: string[] }
    | null
    | undefined;

  if (accessibleProjects === 'all') {
    initialWorkItemsFilters = undefined;
  } else if (accessibleProjects.length > 0) {
    initialWorkItemsFilters = { projectIds: accessibleProjects };
  } else {
    initialWorkItemsFilters = null;
  }

  const [projects, projectMembers, initialWorkItems, sprintsResult] =
    await Promise.all([
      safeServerFetch(getProjectList(), [], 'fetch projects for backlog'),
      safeServerFetch(getUserList(), [], 'fetch users for backlog'),
      initialWorkItemsFilters === null
        ? Promise.resolve([])
        : safeServerFetch(
            getWorkItems(initialWorkItemsFilters),
            [],
            'fetch work items for backlog'
          ),
      getSprintsPaginatedServer('active', 1, 100).catch((error: unknown) => {
        fetchError =
          error instanceof Error
            ? error.message
            : 'Failed to fetch backlog sprints.';
        console.error('error. failed to fetch backlog sprints:', fetchError);
        return EMPTY_ACTIVE_SPRINTS_PAGE;
      }),
    ]);

  const visibleProjects =
    accessibleProjects === 'all'
      ? projects
      : projects.filter((project) => accessibleProjects.includes(project.id));

  const activeProjects = filterActiveProjects(visibleProjects);

  const sprints =
    accessibleProjects === 'all'
      ? sprintsResult.sprints
      : sprintsResult.sprints.filter(
          (sprint) =>
            sprint.project?.id && accessibleProjects.includes(sprint.project.id)
        );

  const suggestedDefaults = dbUser
    ? await getSuggestedBoardDefaults(dbUser, activeProjects, sprints)
    : null;

  return {
    projects: activeProjects,
    projectMembers,
    initialWorkItems,
    sprints,
    userRole,
    currentUserId: dbUser?.id,
    suggestedDefaults,
    error: fetchError,
  };
}
