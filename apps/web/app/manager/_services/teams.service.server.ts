import { apiFetch } from '@/lib/api/api-client.server';
import { Tables } from '@repo/types';
import type { User } from '@/app/users/_services/users.service';

export type Team = Tables<'teams'> & {
  manager?: Pick<User, 'id' | 'name' | 'email'> | null;
};

const apiTeams = '/api/teams';

export async function getTeamList(): Promise<Team[]> {
  const data = await apiFetch<{ teams: Team[] }>(apiTeams, {
    next: { revalidate: 0 },
  });
  return data.teams;
}

export type GetTeamsPaginatedResponse = {
  teams: Team[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function getTeamListPaginated(
  page: number,
  limit: number,
  status?: 'active' | 'inactive' | 'archived',
  search?: string
): Promise<GetTeamsPaginatedResponse> {
  let url = `${apiTeams}?page=${page}&limit=${limit}`;
  if (status) {
    url += `&status=${status}`;
  }
  if (search) {
    url += `&search=${encodeURIComponent(search)}`;
  }

  const data = await apiFetch<GetTeamsPaginatedResponse>(url, {
    next: { revalidate: 0 },
  });
  return data;
}

export type CreateTeamInput = Omit<
  Tables<'teams'>,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
>;

export type UpdateTeamInput = Partial<CreateTeamInput>;

export async function createTeam(input: CreateTeamInput): Promise<Tables<'teams'>> {
  const data = await apiFetch<{ team: Tables<'teams'> }>(apiTeams, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.team;
}

export async function updateTeam(
  id: string,
  input: UpdateTeamInput
): Promise<Tables<'teams'>> {
  const data = await apiFetch<{ team: Tables<'teams'> }>(`${apiTeams}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return data.team;
}

export async function softDeleteTeam(id: string): Promise<Tables<'teams'>> {
  const data = await apiFetch<{ team: Tables<'teams'> }>(
    `${apiTeams}/${id}/soft-delete`,
    {
      method: 'PATCH',
    }
  );
  return data.team;
}

export async function restoreTeam(id: string): Promise<Tables<'teams'>> {
  const data = await apiFetch<{ team: Tables<'teams'> }>(
    `${apiTeams}/${id}/restore`,
    {
      method: 'PATCH',
    }
  );
  return data.team;
}

export async function hardDeleteTeam(id: string): Promise<void> {
  await apiFetch<void>(`${apiTeams}/${id}`, {
    method: 'DELETE',
  });
}
