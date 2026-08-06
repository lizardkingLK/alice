import { apiFetch } from '@/lib/api/api-client';
import { forceOptimisticPatch } from '@/lib/optimistic-lock/force-patch';
import type { SprintResponse, SprintRowWithProject, Tables } from '@repo/types';
export { mapSprintRowToResponse as mapDbSprintToSprint } from '@repo/types';

/** Re-export the shared response type under its original local name. */
export type Sprint = SprintResponse;

/** Re-export the shared DB row type under its original local name. */
export type DbSprintRelation = SprintRowWithProject;


export type CreateSprintInput = {
  name: Tables<'sprints'>['name'];
  goal?: Tables<'sprints'>['goal'];
  projectId: Tables<'sprints'>['project_id'];
  startDate: Tables<'sprints'>['start_date'];
  endDate: Tables<'sprints'>['end_date'];
};

const apiSprints = '/api/sprints';

export async function createSprint(input: CreateSprintInput): Promise<Sprint> {
  const data = await apiFetch<{ sprint: Sprint }>(apiSprints, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return data.sprint;
}

export type PaginatedSprints = {
  sprints: Sprint[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
};

export async function updateSprintStatus(
  id: string,
  status: Sprint['status'],
  expectedUpdatedAt: string
): Promise<Sprint> {
  const data = await apiFetch<{ sprint: Sprint }>(
    `${apiSprints}/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, expectedUpdatedAt }),
    }
  );

  return data.sprint;
}

export async function updateSprint(
  id: string,
  input: CreateSprintInput,
  expectedUpdatedAt: string
): Promise<Sprint> {
  const data = await apiFetch<{ sprint: Sprint }>(`${apiSprints}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...input, expectedUpdatedAt }),
  });

  return data.sprint;
}

/** Force-apply pending fields after a user confirms Keep mine / merge. */
export async function forceUpdateSprint(
  id: string,
  pendingFields: Record<string, unknown>,
  expectedUpdatedAt: string
): Promise<Sprint> {
  const data = await forceOptimisticPatch<{ sprint: Sprint }>(
    apiFetch,
    `${apiSprints}/${id}`,
    { pendingFields, expectedUpdatedAt, method: 'PATCH' }
  );

  return data.sprint;
}

/** Force-apply status after conflict resolution on the status endpoint. */
export async function forceUpdateSprintStatus(
  id: string,
  pendingFields: Record<string, unknown>,
  expectedUpdatedAt: string
): Promise<Sprint> {
  const status = pendingFields.status as Sprint['status'] | undefined;
  if (!status) {
    return forceUpdateSprint(id, pendingFields, expectedUpdatedAt);
  }

  const data = await apiFetch<{ sprint: Sprint }>(
    `${apiSprints}/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, expectedUpdatedAt }),
    }
  );

  return data.sprint;
}
