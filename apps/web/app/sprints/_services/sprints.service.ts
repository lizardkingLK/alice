import { apiFetch } from '@/lib/api/api-client';
import { Tables } from '@repo/types';

type DbSprint = Tables<'sprints'>;

export type SprintStatus = 'Not Started' | 'Ongoing' | 'Completed' | 'Archived';

const dbStatusToResponseMap = {
  planned: 'Not Started',
  active: 'Ongoing',
  closed: 'Completed',
  archived: 'Archived',
} as const satisfies Record<DbSprint['status'], SprintStatus>;

export type Sprint = Pick<DbSprint, 'id' | 'name' | 'goal'> & {
  status: SprintStatus;
  startDate: DbSprint['start_date'];
  endDate: DbSprint['end_date'];
  createdBy: string;
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
    status: dbStatusToResponseMap[row.status] ?? 'Not Started',
    startDate: row.start_date,
    endDate: row.end_date,
    createdBy: row.created_by ?? '',
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

export async function listSprints(
  tab?: 'active' | 'archived',
  page?: number,
  limit?: number,
  search?: string
): Promise<PaginatedSprints> {
  const params = new URLSearchParams();
  if (tab) params.append('status', tab);
  if (page) params.append('page', page.toString());
  if (limit) params.append('limit', limit.toString());
  if (search) params.append('search', search);

  return apiFetch<PaginatedSprints>(`${apiSprints}?${params.toString()}`);
}

export async function updateSprintStatus(
  id: string,
  status: Sprint['status']
): Promise<Sprint> {
  const data = await apiFetch<{ sprint: Sprint }>(
    `${apiSprints}/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }
  );

  return data.sprint;
}

export async function getSprint(id: string): Promise<Sprint> {
  const data = await apiFetch<{ sprint: Sprint }>(`${apiSprints}/${id}`);
  return data.sprint;
}

export async function updateSprint(
  id: string,
  input: CreateSprintInput
): Promise<Sprint> {
  const data = await apiFetch<{ sprint: Sprint }>(`${apiSprints}/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

  return data.sprint;
}
