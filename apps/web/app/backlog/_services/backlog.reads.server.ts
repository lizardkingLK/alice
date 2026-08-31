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

  const [projects, projectMembers, initialWorkItems, sprintsResult] =
    await Promise.all([
      safeServerFetch(getProjectList(), [], 'fetch projects for backlog'),
      safeServerFetch(getUserList(), [], 'fetch users for backlog'),
      safeServerFetch(getWorkItems(), [], 'fetch work items for backlog'),
      getSprintsPaginatedServer('active', 1, 100).catch((error: unknown) => {
        fetchError =
          error instanceof Error
            ? error.message
            : 'Failed to fetch backlog sprints.';
        console.error('error. failed to fetch backlog sprints:', fetchError);
        return EMPTY_ACTIVE_SPRINTS_PAGE;
      }),
    ]);

  const activeProjects = filterActiveProjects(projects);
  const suggestedDefaults = dbUser
    ? await getSuggestedBoardDefaults(
        dbUser,
        activeProjects,
        sprintsResult.sprints
      )
    : null;

  return {
    projects: activeProjects,
    projectMembers,
    initialWorkItems,
    sprints: sprintsResult.sprints,
    userRole,
    currentUserId: dbUser?.id,
    suggestedDefaults,
    error: fetchError,
  };
}
