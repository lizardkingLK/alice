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

/** Sprint select options scoped to the active project filter (or all). */
export function buildSprintFilterOptions(
  sprints: readonly Sprint[],
  projectFilter: string
): { readonly value: string; readonly label: string }[] {
  const scoped = projectFilter
    ? sprints.filter((sprint) => sprint.project?.id === projectFilter)
    : sprints;
  return scoped.map((sprint) => ({
    value: sprint.id,
    label: sprint.name,
  }));
}

/**
 * Mutates search params when the project filter changes: clears sprint on
 * "all", otherwise pairs the project with a suggested default sprint.
 */
export function applyProjectFilterToSearchParams(
  params: URLSearchParams,
  options: {
    readonly nextProject: string;
    readonly sprints: readonly Sprint[];
    readonly allValue?: string;
    /** Board drops `page`; list pages reset to `1`. */
    readonly pageMode?: 'delete' | 'one';
  }
): void {
  const allValue = options.allValue ?? 'all';
  if (!options.nextProject || options.nextProject === allValue) {
    params.delete('project');
    params.delete('sprint');
  } else {
    params.set('project', options.nextProject);
    const defaultSprint = resolveDefaultBoardSprint(
      options.sprints,
      options.nextProject
    );
    if (defaultSprint) {
      params.set('sprint', defaultSprint.id);
    } else {
      params.delete('sprint');
    }
  }

  if (options.pageMode === 'one') {
    params.set('page', '1');
  } else if (options.pageMode === 'delete') {
    params.delete('page');
  }
}

export function buildWorkspaceFilterRedirectPath(
  pathname: string,
  options: {
    readonly projectId?: string;
    readonly sprintId?: string;
  }
): string | null {
  const params = new URLSearchParams();
  if (options.projectId) {
    params.set('project', options.projectId);
  }
  if (options.sprintId) {
    params.set('sprint', options.sprintId);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : null;
}

export function buildBoardFilterRedirectPath(options: {
  readonly projectId?: string;
  readonly sprintId?: string;
}): string | null {
  return buildWorkspaceFilterRedirectPath('/board', options);
}
