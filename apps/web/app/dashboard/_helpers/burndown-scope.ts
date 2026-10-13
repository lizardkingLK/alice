import { ALL_PROJECTS_ID } from '@/app/board/_helpers/workspace-defaults-shared';
import { SprintStatusEnum } from '@repo/types';

export type BurndownScopeSprint = {
  readonly id: string;
  readonly name: string;
  readonly status: string;
  readonly project?: {
    readonly id: string;
    readonly name: string;
  } | null;
};

export type BurndownScopePreference = {
  readonly projectId: string;
  readonly sprintId: string | null;
};

export type BurndownScopeLabelsModel = {
  readonly projectName: string | null;
  readonly sprintName: string | null;
  readonly sprintId: string | null;
};

/** Pick the sprint that drives overview burndown (defaults → Active → Planned). */
export function selectBurndownSprint(
  sprints: readonly BurndownScopeSprint[],
  preference: BurndownScopePreference | null
): BurndownScopeSprint | undefined {
  const candidates =
    preference?.projectId && preference.projectId !== ALL_PROJECTS_ID
      ? sprints.filter((sprint) => sprint.project?.id === preference.projectId)
      : sprints;

  return (
    (preference?.sprintId
      ? candidates.find((sprint) => sprint.id === preference.sprintId)
      : undefined) ??
    candidates.find((sprint) => sprint.status === SprintStatusEnum.Active) ??
    candidates.find((sprint) => sprint.status === SprintStatusEnum.Planned) ??
    candidates[0]
  );
}

export function burndownScopeFromSprint(
  sprint: BurndownScopeSprint | null | undefined
): BurndownScopeLabelsModel {
  if (!sprint) {
    return { projectName: null, sprintName: null, sprintId: null };
  }

  return {
    projectName: sprint.project?.name ?? null,
    sprintName: sprint.name,
    sprintId: sprint.id,
  };
}
