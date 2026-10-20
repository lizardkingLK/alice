import type { ProjectTeamMemberCapacity } from '@/app/backlog/_helpers/backlog-sprint-capacity';
import type { DbWorkItem } from '@/app/work-items/_types/work-items.reads.types';
import type { SprintRowWithProject } from '@repo/types';

export type BacklogWorkspaceBundlePayload = {
  readonly workItems: DbWorkItem[];
  readonly sprintRows: SprintRowWithProject[];
  readonly teamCapacities: ProjectTeamMemberCapacity[];
};

function asObjectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (entry): entry is Record<string, unknown> =>
      Boolean(entry) && typeof entry === 'object' && !Array.isArray(entry)
  );
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function mapTeamCapacity(
  row: Record<string, unknown>
): ProjectTeamMemberCapacity | null {
  const projectId = asNullableString(row.projectId);
  const userId = asNullableString(row.userId);
  if (!projectId || !userId) {
    return null;
  }
  return {
    projectId,
    userId,
    capacity: typeof row.capacity === 'number' ? row.capacity : null,
    allocation: typeof row.allocation === 'number' ? row.allocation : null,
  };
}

/**
 * Parse `get_backlog_workspace_bundle` jsonb into typed workspace slices.
 * Work items are list-shaped scalars (assignee filled later via member enrich).
 */
export function parseBacklogWorkspaceBundle(
  data: unknown
): BacklogWorkspaceBundlePayload | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const row = data as Record<string, unknown>;

  const workItems = asObjectArray(row.work_items).map((item) => ({
    ...item,
    assignee: null,
    reporter: null,
  })) as unknown as DbWorkItem[];

  const sprintRows = asObjectArray(
    row.sprints
  ) as unknown as SprintRowWithProject[];

  const teamCapacities = asObjectArray(row.team_capacities)
    .map(mapTeamCapacity)
    .filter((entry): entry is ProjectTeamMemberCapacity => entry !== null);

  return { workItems, sprintRows, teamCapacities };
}
