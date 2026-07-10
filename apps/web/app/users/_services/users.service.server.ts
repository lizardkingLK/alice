import { apiFetch } from '@/lib/api/api-client.server';
import { Tables } from '@repo/types';

export type User = Tables<'users'>;

const apiUsers = '/api/users';

export type GetUsersPaginatedResponse = {
  users: User[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

export async function getUsersList(): Promise<User[]> {
  const data = await apiFetch<{ users: User[] }>(apiUsers, {
    next: { revalidate: 0 },
  });
  return data.users;
}

export async function getUsersListPaginated(
  page: number,
  limit: number
): Promise<GetUsersPaginatedResponse> {
  const url = `${apiUsers}?page=${page}&limit=${limit}`;
  const data = await apiFetch<GetUsersPaginatedResponse>(url, {
    next: { revalidate: 0 },
  });
  return data;
}

export async function getUserList(): Promise<User[]> {
  const users = await getUsersList();
  return users
    .filter((u) => u.active)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type CreateUserInput = {
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'member';
  redirectTo: string;
};

export async function createUser(input: CreateUserInput): Promise<User> {
  const data = await apiFetch<{ user: User }>(apiUsers, {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return data.user;
}

export type UpdateUserInput = {
  name: string;
  role: 'admin' | 'manager' | 'member';
};

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const data = await apiFetch<{ user: User }>(`${apiUsers}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  return data.user;
}

export async function toggleUserActive(id: string, active: boolean): Promise<User> {
  const data = await apiFetch<{ user: User }>(`${apiUsers}/${id}/toggle-active`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  });
  return data.user;
}
