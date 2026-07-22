import { apiFetch } from '@/lib/api/api-client.server';
import { createClient } from '@/lib/supabase/server';
import { pageRange, paginationMeta } from '@/lib/db/pagination';
import { createUsersService } from './users.service.base';
import type { GetUsersPaginatedResponse, User } from './users.service.base';

const service = createUsersService(apiFetch);

/**
 * Reads query Supabase directly from the RSC layer to skip the `web → api`
 * hop. Mutations (create/update/toggle) still go through the API.
 */

export async function getUsersList(): Promise<User[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('error. failed to list users:', error.message);
    throw new Error('Failed to list users');
  }

  return (data ?? []) as User[];
}

export async function getUsersListPaginated(
  page: number,
  limit: number,
  search = ''
): Promise<GetUsersPaginatedResponse> {
  const supabase = await createClient();
  const { from, to } = pageRange(page, limit);

  let query = supabase
    .from('users')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false });

  const term = search.trim().replace(/[,()]/g, '');
  if (term) {
    query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%`);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    console.error('error. failed to list users paginated:', error.message);
    throw new Error('Failed to list users');
  }

  return {
    users: (data ?? []) as User[],
    ...paginationMeta(count ?? 0, page, limit),
  };
}

export async function getUserList(): Promise<User[]> {
  const users = await getUsersList();
  return users
    .filter((u) => u.active)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export const createUser = service.createUser;
export const updateUser = service.updateUser;
export const toggleUserActive = service.toggleUserActive;

export type {
  User,
  GetUsersPaginatedResponse,
  CreateUserInput,
  UpdateUserInput,
} from './users.service.base';
