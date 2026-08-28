import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import { filterActiveProjects } from '@/lib/projects/active-projects';
import { SprintStatusEnum } from '@repo/types';

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

  const ongoing = forProject.find(
    (sprint) => sprint.status === SprintStatusEnum.Active
  );
  if (ongoing) {
    return ongoing;
  }

  const notStarted = forProject.find(
    (sprint) => sprint.status === SprintStatusEnum.Planned
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

/** Scope sprint options by an optimistic list-filter project value (`all` → unscoped). */
export function buildSprintFilterOptionsForQuery(
  sprints: readonly Sprint[],
  projectValue: string,
  allValue: string = 'all'
): { readonly value: string; readonly label: string }[] {
  const scopedProject = projectValue === allValue ? '' : projectValue;
  return buildSprintFilterOptions(sprints, scopedProject);
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
    // Keep an explicit sentinel so SSR can tell "All projects" from
    // "no project yet — needs client bootstrap".
    params.set('project', allValue);
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

/**
 * Optimistic project filter change: rewrite URL params, update local select
 * state immediately, then navigate (shared by board + work-items).
 */
export function pushOptimisticProjectFilter(options: {
  readonly searchParams: { readonly toString: () => string };
  readonly nextProject: string;
  readonly sprints: readonly Sprint[];
  readonly allValue: string;
  readonly pageMode: 'delete' | 'one';
  readonly pathname: string;
  // eslint-disable-next-line no-unused-vars -- navigate callback
  readonly push: (href: string) => void;
  // eslint-disable-next-line no-unused-vars -- optimistic setter
  readonly setProjectValue: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- optimistic setter
  readonly setSprintValue: (value: string) => void;
  /** Extra param tweaks after project/sprint pairing (e.g. list view). */
  // eslint-disable-next-line no-unused-vars -- optional mutate hook
  readonly afterApply?: (params: URLSearchParams) => void;
}): void {
  const params = new URLSearchParams(options.searchParams.toString());
  applyProjectFilterToSearchParams(params, {
    nextProject: options.nextProject,
    sprints: options.sprints,
    allValue: options.allValue,
    pageMode: options.pageMode,
  });
  options.afterApply?.(params);

  options.setProjectValue(options.nextProject);
  options.setSprintValue(params.get('sprint') ?? options.allValue);

  const query = params.toString();
  options.push(query ? `${options.pathname}?${query}` : options.pathname);
}

export function buildWorkspaceFilterRedirectPath(
  pathname: string,
  options: {
    readonly projectId?: string;
    readonly sprintId?: string;
    /** Preserved when seeding defaults (e.g. `calendar` on `/board`). */
    readonly tab?: string;
  }
): string | null {
  const params = new URLSearchParams();
  if (options.projectId) {
    params.set('project', options.projectId);
  }
  if (options.sprintId) {
    params.set('sprint', options.sprintId);
  }
  if (options.tab) {
    params.set('tab', options.tab);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : null;
}

/** Routes that honor workspace project/sprint defaults in the URL. */
export const WORKSPACE_DEFAULT_QUERY_PATHS = [
  '/backlog',
  '/board',
  '/work-items',
] as const;

export type WorkspaceDefaultQueryPath =
  (typeof WORKSPACE_DEFAULT_QUERY_PATHS)[number];

export function isWorkspaceDefaultQueryPath(
  path: string
): path is WorkspaceDefaultQueryPath {
  return (WORKSPACE_DEFAULT_QUERY_PATHS as readonly string[]).includes(path);
}

/**
 * Attach stored project/sprint defaults to a workspace nav path.
 * Returns the bare path when there is no preference.
 */
export function buildWorkspaceNavHref(
  basePath: string,
  preference: {
    readonly projectId: string;
    readonly sprintId: string | null;
  } | null
): string {
  if (!preference || !isWorkspaceDefaultQueryPath(basePath)) {
    return basePath;
  }

  return (
    buildWorkspaceFilterRedirectPath(basePath, {
      projectId: preference.projectId,
      sprintId: preference.sprintId ?? undefined,
    }) ?? basePath
  );
}

export function buildBoardFilterRedirectPath(options: {
  readonly projectId?: string;
  readonly sprintId?: string;
}): string | null {
  return buildWorkspaceFilterRedirectPath('/board', options);
}
