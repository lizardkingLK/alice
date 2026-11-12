/* eslint-disable no-unused-vars */
import { Tables } from '@repo/types';
import type { User } from '@/app/users/_services/users.mutations.client';
import { forceOptimisticPatch } from '@/lib/optimistic-lock/force-patch';
import type { DestructiveActionAccepted } from '@/lib/api/destructive-action-accepted';

export type { DestructiveActionAccepted } from '@/lib/api/destructive-action-accepted';

export type Team = Tables<'teams'> & {
  manager?: Pick<User, 'id' | 'name' | 'email'> | null;
  members?: {
    team_id: string;
    user_id: string;
    capacity?: number | null;
    allocation?: number | null;
    status: 'active' | 'inactive' | 'archived' | 'deleted';
  }[];
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
> & {
  member_ids?: string[];
};

export type UpdateTeamInput = Partial<CreateTeamInput>;

export function createTeamsService(
  apiFetch: <T>(
    path: string,
    init?: RequestInit & { skipDatabaseBusyRetry?: boolean }
  ) => Promise<T>
) {
  const apiTeams = '/api/teams';

  return {
    async createTeam(input: CreateTeamInput): Promise<Tables<'teams'>> {
      const data = await apiFetch<{ team: Tables<'teams'> }>(apiTeams, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return data.team;
    },

    async updateTeam(
      id: string,
      input: UpdateTeamInput,
      expectedUpdatedAt: string
    ): Promise<Tables<'teams'>> {
      const data = await apiFetch<{ team: Tables<'teams'> }>(
        `${apiTeams}/${id}`,
        {
          method: 'PUT',
          body: JSON.stringify({ ...input, expectedUpdatedAt }),
        }
      );
      return data.team;
    },

    /** Force-apply pending fields after a user confirms Keep mine / merge. */
    async forceUpdateTeam(
      id: string,
      pendingFields: Record<string, unknown>,
      expectedUpdatedAt: string
    ): Promise<Tables<'teams'>> {
      const data = await forceOptimisticPatch<{ team: Tables<'teams'> }>(
        apiFetch,
        `${apiTeams}/${id}`,
        { pendingFields, expectedUpdatedAt }
      );
      return data.team;
    },

    /** Fire-and-forget archive — API returns 202; inbox notifies when done. */
    async softDeleteTeam(
      id: string,
      expectedUpdatedAt: string
    ): Promise<DestructiveActionAccepted> {
      return await apiFetch<DestructiveActionAccepted>(
        `${apiTeams}/${id}/soft-delete`,
        {
          method: 'PATCH',
          body: JSON.stringify({ expectedUpdatedAt }),
          skipDatabaseBusyRetry: true,
        }
      );
    },

    async restoreTeam(
      id: string,
      expectedUpdatedAt: string
    ): Promise<Tables<'teams'>> {
      const data = await apiFetch<{ team: Tables<'teams'> }>(
        `${apiTeams}/${id}/restore`,
        {
          method: 'PATCH',
          body: JSON.stringify({ expectedUpdatedAt }),
        }
      );
      return data.team;
    },

    /** Fire-and-forget purge — API returns 202; inbox notifies when done. */
    async hardDeleteTeam(id: string): Promise<DestructiveActionAccepted> {
      return await apiFetch<DestructiveActionAccepted>(`${apiTeams}/${id}`, {
        method: 'DELETE',
        skipDatabaseBusyRetry: true,
      });
    },
  };
}
