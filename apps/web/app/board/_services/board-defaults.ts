import type { Project } from '@/app/projects/_services/projects.service.base';
import type { Sprint } from '@/app/sprints/_services/sprints.service';
import { filterActiveProjects } from '@/lib/projects/active-projects';

/**
 * Prefer owned active projects for managers, else membership, else first active.
 * Used when there is no stored preferred-project preference yet.
 */
export function resolveDefaultBoardProject(
  projects: Project[],
  options: {
    readonly userId: string;
    readonly role: string;
    readonly memberProjectIds: readonly string[];
  }
): Project | null {
  const active = filterActiveProjects(projects);
  if (active.length === 0) {
    return null;
  }

  const memberSet = new Set(options.memberProjectIds);

  if (options.role === 'manager') {
    const owned = active.find((project) => project.owner_id === options.userId);
    if (owned) {
      return owned;
    }
  }

  const membership = active.find((project) => memberSet.has(project.id));
  if (membership) {
    return membership;
  }

  // Fallback: first active project (keeps board usable if membership lags).
  return active[0] ?? null;
}

/**
 * Prefer Ongoing, else Not Started, for the selected project.
 */
export function resolveDefaultBoardSprint(
  sprints: readonly Sprint[],
  projectId: string
): Sprint | null {
  const forProject = sprints.filter(
    (sprint) => sprint.project?.id === projectId
  );

  const ongoing = forProject.find((sprint) => sprint.status === 'Ongoing');
  if (ongoing) {
    return ongoing;
  }

  const notStarted = forProject.find(
    (sprint) => sprint.status === 'Not Started'
  );
  return notStarted ?? forProject[0] ?? null;
}

export function buildBoardFilterRedirectPath(options: {
  readonly projectId?: string;
  readonly sprintId?: string;
}): string | null {
  const params = new URLSearchParams();
  if (options.projectId) {
    params.set('project', options.projectId);
  }
  if (options.sprintId) {
    params.set('sprint', options.sprintId);
  }

  const query = params.toString();
  return query ? `/board?${query}` : null;
}
