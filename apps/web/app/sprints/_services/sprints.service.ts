import { apiFetch } from '@/lib/api/api-client';
import { forceOptimisticPatch } from '@/lib/optimistic-lock/force-patch';
import { Tables, type SprintStatus } from '@repo/types';

type DbSprint = Tables<'sprints'>;

export type Sprint = Pick<DbSprint, 'id' | 'name' | 'goal'> & {
  status: SprintStatus;
  startDate: DbSprint['start_date'];
  endDate: DbSprint['end_date'];
  createdBy: string;
  updatedBy: DbSprint['updated_by'];
  createdAt: DbSprint['created_at'];
  updatedAt: DbSprint['updated_at'];
  project?: {
    id: string;
    name: string;
    key: string;
  } | null;
};

export type DbSprintRelation = DbSprint & {
  project: {
    id: string;
    name: string;
    key: string;
  } | null;
};

export function mapDbSprintToSprint(row: DbSprintRelation): Sprint {
  return {
    id: row.id,
    name: row.name,
    goal: row.goal,
    status: row.status,
    startDate: row.start_date,
    endDate: row.end_date,
    createdBy: row.created_by ?? '',
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    project: row.project
      ? {
          id: row.project.id,
          name: row.project.name,
          key: row.project.key,
        }
      : null,
  };
}

export type CreateSprintInput = {
  name: DbSprint['name'];
  goal?: DbSprint['goal'];
  projectId: DbSprint['project_id'];
  startDate: DbSprint['start_date'];
  endDate: DbSprint['end_date'];
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
