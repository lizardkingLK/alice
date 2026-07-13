/* eslint-disable no-unused-vars */
import { Tables } from '@repo/types';
import type { User } from '@/app/users/_services/users.service';

export type Team = Tables<'teams'> & {
  manager?: Pick<User, 'id' | 'name' | 'email'> | null;
};

export type GetTeamsPaginatedResponse = {
  teams: Team[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CreateTeamInput = Omit<
  Tables<'teams'>,
  'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
>;

export type UpdateTeamInput = Partial<CreateTeamInput>;

export function createTeamsService(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
) {
  const apiTeams = '/api/teams';

  return {
    async getTeamList(): Promise<Team[]> {
      const data = await apiFetch<{ teams: Team[] }>(apiTeams);
      return data.teams;
    },

    async getTeamListPaginated(
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

      return apiFetch<GetTeamsPaginatedResponse>(url);
    },

    async createTeam(input: CreateTeamInput): Promise<Tables<'teams'>> {
      const data = await apiFetch<{ team: Tables<'teams'> }>(apiTeams, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return data.team;
    },

    async updateTeam(
      id: string,
      input: UpdateTeamInput
    ): Promise<Tables<'teams'>> {
      const data = await apiFetch<{ team: Tables<'teams'> }>(
        `${apiTeams}/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify(input),
        }
      );
      return data.team;
    },

    async softDeleteTeam(id: string): Promise<Tables<'teams'>> {
      const data = await apiFetch<{ team: Tables<'teams'> }>(
        `${apiTeams}/${id}/soft-delete`,
        {
          method: 'PATCH',
        }
      );
      return data.team;
    },

    async restoreTeam(id: string): Promise<Tables<'teams'>> {
      const data = await apiFetch<{ team: Tables<'teams'> }>(
        `${apiTeams}/${id}/restore`,
        {
          method: 'PATCH',
        }
      );
      return data.team;
    },

    async hardDeleteTeam(id: string): Promise<void> {
      await apiFetch<void>(`${apiTeams}/${id}`, {
        method: 'DELETE',
      });
    },
  };
}
