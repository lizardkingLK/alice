import type {
  Project,
  ProjectMemberWithUser,
} from '@/app/projects/_types/projects.types';

export type ProjectWorkspaceBundlePayload = {
  readonly project: Project;
  readonly members: ProjectMemberWithUser[];
  readonly workItemTotal: number;
  readonly teamTotal: number;
  readonly sprintTotal: number;
};

function asObject(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
  );
}

function asNonNegativeInt(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.floor(value)
    : 0;
}

/**
 * Parse `get_project_workspace_bundle` jsonb into typed workspace core slices.
 */
export function parseProjectWorkspaceBundle(
  data: unknown
): ProjectWorkspaceBundlePayload | null {
  const row = asObject(data);
  if (!row) {
    return null;
  }

  const project = asObject(row.project) as Project | null;
  if (!project?.id || typeof project.id !== 'string') {
    return null;
  }

  const members = asObjectArray(row.members).filter(
    (member): member is ProjectMemberWithUser & Record<string, unknown> =>
      typeof member.project_id === 'string' &&
      typeof member.user_id === 'string' &&
      typeof member.status === 'string'
  ) as unknown as ProjectMemberWithUser[];

  return {
    project,
    members,
    workItemTotal: asNonNegativeInt(row.work_item_total),
    teamTotal: asNonNegativeInt(row.team_total),
    sprintTotal: asNonNegativeInt(row.sprint_total),
  };
}
