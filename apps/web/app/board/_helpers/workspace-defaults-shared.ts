import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import {
  ALL_PROJECTS_ID,
  readValidatedBoardDefaults,
} from '@/app/board/_helpers/board-defaults-storage';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';

export { ALL_PROJECTS_ID };

type SprintLookup = ReadonlyMap<string, { readonly projectId: string | null }>;

export function buildSprintLookup(sprints: readonly Sprint[]) {
  return new Map(
    sprints.map((sprint) => [
      sprint.id,
      { projectId: sprint.project?.id ?? null },
    ])
  );
}

export function buildProjectSprintLookups(
  projects: readonly { readonly id: string }[],
  sprints: readonly Sprint[]
) {
  return {
    projectIds: new Set(projects.map((project) => project.id)),
    sprintById: buildSprintLookup(sprints),
  };
}

/**
 * Read stored defaults, clear corrupt preferences, and return validated state.
 */
export function loadValidatedBoardDefaults(
  userId: string,
  projectIds: ReadonlySet<string>,
  sprintById: SprintLookup
) {
  return readValidatedBoardDefaults(userId, projectIds, sprintById);
}

export function resolveOpenDefaultsPreference(
  userId: string,
  projectIds: ReadonlySet<string>,
  sprintById: SprintLookup,
  fallback: BoardDefaultsPreference
): BoardDefaultsPreference {
  const { preference: validated } = readValidatedBoardDefaults(
    userId,
    projectIds,
    sprintById
  );
  return validated ?? fallback;
}

export function isAllProjectsPreference(
  preference: BoardDefaultsPreference
): boolean {
  return preference.projectId === ALL_PROJECTS_ID;
}

/** Resolve saved defaults to display labels (null preference → All projects). */
export function resolveWorkspaceDefaultsAppliedSummary(
  preference: BoardDefaultsPreference | null,
  projects: readonly { readonly id: string; readonly name: string }[],
  sprints: readonly {
    readonly id: string;
    readonly name: string;
  }[]
): { readonly projectName: string; readonly sprintName: string | null } {
  if (!preference || isAllProjectsPreference(preference)) {
    return { projectName: 'All projects', sprintName: null };
  }
  const projectName =
    projects.find((project) => project.id === preference.projectId)?.name ??
    preference.projectId;
  const sprintName = preference.sprintId
    ? (sprints.find((sprint) => sprint.id === preference.sprintId)?.name ??
      preference.sprintId)
    : null;
  return { projectName, sprintName };
}

/**
 * True when the URL has no `project` query yet (client should seed defaults).
 * `project=all` is an intentional All-projects filter, not bootstrap.
 */
export function needsWorkspaceProjectBootstrap(
  projectQuery: string | null | undefined
): boolean {
  return !projectQuery?.trim();
}

export function preferenceToProjectFilter(
  preference: BoardDefaultsPreference
): string {
  return isAllProjectsPreference(preference) ? 'all' : preference.projectId;
}

export function projectFilterToPreference(
  projectFilter: string,
  sprintFilter = ''
): BoardDefaultsPreference {
  return {
    projectId:
      projectFilter === 'all' || !projectFilter
        ? ALL_PROJECTS_ID
        : projectFilter,
    sprintId: sprintFilter || null,
  };
}

export function preferenceToSprintFilter(
  preference: BoardDefaultsPreference | null | undefined
): string {
  return preference?.sprintId ?? '';
}

export function preferenceMatchesBoardFilters(
  preference: BoardDefaultsPreference,
  projectFilter: string,
  sprintFilter: string
): boolean {
  if (isAllProjectsPreference(preference)) {
    return (
      (!projectFilter || projectFilter === 'all') &&
      (preference.sprintId ?? '') === sprintFilter
    );
  }
  return (
    preference.projectId === projectFilter &&
    (preference.sprintId ?? '') === sprintFilter
  );
}

/** Which filter pane owns a “Set as default” intent. */
export type WorkspaceDefaultsSaveIntent = 'project' | 'sprint';

/**
 * Build a storage preference from filter draft + save intent.
 * Returns null for All/All (caller clears localStorage).
 */
export function resolvePreferenceFromFilterDraft(options: {
  readonly intent: WorkspaceDefaultsSaveIntent;
  readonly projectValue: string;
  readonly sprintValue: string;
  readonly allValue?: string;
  readonly sprints: readonly {
    readonly id: string;
    readonly project?: { readonly id: string } | null;
  }[];
}): BoardDefaultsPreference | null {
  const allValue = options.allValue ?? 'all';
  const projectIsAll =
    !options.projectValue || options.projectValue === allValue;
  const sprintIsAll = !options.sprintValue || options.sprintValue === allValue;

  if (options.intent === 'project') {
    if (projectIsAll) {
      return null;
    }
    return { projectId: options.projectValue, sprintId: null };
  }

  if (sprintIsAll) {
    if (projectIsAll) {
      return null;
    }
    return { projectId: options.projectValue, sprintId: null };
  }

  const sprint = options.sprints.find(
    (entry) => entry.id === options.sprintValue
  );
  const projectId =
    sprint?.project?.id ?? (projectIsAll ? null : options.projectValue);

  if (!projectId) {
    return null;
  }

  return { projectId, sprintId: options.sprintValue };
}
