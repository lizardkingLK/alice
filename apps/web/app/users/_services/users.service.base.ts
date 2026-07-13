/* eslint-disable no-unused-vars */
import { Tables } from '@repo/types';

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

  async function getUsersList(): Promise<User[]> {
    const data = await apiFetch<{ users: User[] }>(apiUsers);
    return data.users;
  }

  return {
    getUsersList,

    async getUsersListPaginated(
      page: number,
      limit: number
    ): Promise<GetUsersPaginatedResponse> {
      const url = `${apiUsers}?page=${page}&limit=${limit}`;
      return apiFetch<GetUsersPaginatedResponse>(url);
    },

    async getUserList(): Promise<User[]> {
      const users = await getUsersList();
      return users
        .filter((u) => u.active)
        .sort((a, b) => a.name.localeCompare(b.name));
    },

    async createUser(input: CreateUserInput): Promise<User> {
      const data = await apiFetch<{ user: User }>(apiUsers, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      return data.user;
    },

    async updateUser(id: string, input: UpdateUserInput): Promise<User> {
      const data = await apiFetch<{ user: User }>(`${apiUsers}/${id}`, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      return data.user;
    },

    async toggleUserActive(id: string, active: boolean): Promise<User> {
      const data = await apiFetch<{ user: User }>(
        `${apiUsers}/${id}/toggle-active`,
        {
          method: 'PATCH',
          body: JSON.stringify({ active }),
        }
      );
      return data.user;
    },
  };
}
