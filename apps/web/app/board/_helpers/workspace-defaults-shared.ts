import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import {
  ALL_PROJECTS_ID,
  clearBoardDefaults,
  readValidatedBoardDefaults,
} from '@/app/board/_helpers/board-defaults-storage';
import type { Sprint } from '@/app/sprints/_services/sprints.service';

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
  const { record, preference: validated } = readValidatedBoardDefaults(
    userId,
    projectIds,
    sprintById
  );

  if (record?.preference && !validated) {
    clearBoardDefaults(userId);
  }

  return { record, validated };
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

export function resolveBaselineProjectFilter(
  savedPreference: BoardDefaultsPreference | null,
  suggestedDefaults: BoardDefaultsPreference | null
): string {
  if (savedPreference) {
    return preferenceToProjectFilter(savedPreference);
  }
  if (suggestedDefaults) {
    return preferenceToProjectFilter(suggestedDefaults);
  }
  return 'all';
}

export function preferenceMatchesProjectFilter(
  preference: BoardDefaultsPreference,
  projectFilter: string
): boolean {
  return preferenceToProjectFilter(preference) === projectFilter;
}

export function preferenceMatchesBoardFilters(
  preference: BoardDefaultsPreference,
  projectFilter: string,
  sprintFilter: string
): boolean {
  if (isAllProjectsPreference(preference)) {
    return !projectFilter && (preference.sprintId ?? '') === sprintFilter;
  }
  return (
    preference.projectId === projectFilter &&
    (preference.sprintId ?? '') === sprintFilter
  );
}
