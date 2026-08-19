/* eslint-disable no-unused-vars */
import { Tables } from '@repo/types';
import { forceOptimisticPatch } from '@/lib/optimistic-lock/force-patch';

export type User = Tables<'users'>;

export type GetUsersPaginatedResponse = {
  users: User[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CreateUserInput = {
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member';
  redirectTo: string;
};

export type UpdateUserInput = {
  name: string;
  role: 'admin' | 'manager' | 'member';
};

export function createUsersService(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
) {
  const apiUsers = '/api/users';

  return {
    async createUser(input: CreateUserInput): Promise<User> {
      const data = await apiFetch<{ user: User }>(apiUsers, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return data.user;
    },

    async updateUser(
      id: string,
      input: UpdateUserInput,
      expectedUpdatedAt: string
    ): Promise<User> {
      const data = await apiFetch<{ user: User }>(`${apiUsers}/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ ...input, expectedUpdatedAt }),
      });
      return data.user;
    },

    /** Force-apply pending fields after a user confirms Keep mine / merge. */
    async forceUpdateUser(
      id: string,
      pendingFields: Record<string, unknown>,
      expectedUpdatedAt: string
    ): Promise<User> {
      const data = await forceOptimisticPatch<{ user: User }>(
        apiFetch,
        `${apiUsers}/${id}`,
        { pendingFields, expectedUpdatedAt }
      );
      return data.user;
    },

    async toggleUserActive(
      id: string,
      active: boolean,
      expectedUpdatedAt: string
    ): Promise<User> {
      const data = await apiFetch<{ user: User }>(
        `${apiUsers}/${id}/toggle-active`,
        {
          method: 'PATCH',
          body: JSON.stringify({ active, expectedUpdatedAt }),
        }
      );
      return data.user;
    },
  };
}
