import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { createClient } from '@/lib/supabase/server';
import {
  applyListSearch,
  runPaginatedSelect,
  throwIfError,
} from '@/lib/db/query';
import { getCachedUserList } from '@/lib/cache/dropdown-cache';
import { createUsersService } from './users.mutations.shared';
import type { GetUsersPaginatedResponse, User } from './users.mutations.shared';

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

  throwIfError(error, 'failed to list users', 'Failed to list users');

  return (data ?? []) as User[];
}

export async function getUsersListPaginated(
  page: number,
  limit: number,
  search = ''
): Promise<GetUsersPaginatedResponse> {
  const supabase = await createClient();

  const query = applyListSearch(
    supabase.from('users').select('*', { count: 'exact' }),
    search,
    ['name', 'email']
  );

  const { rows: users, ...meta } = await runPaginatedSelect<User>(
    query,
    page,
    limit,
    {
      orderBy: 'created_at',
      logLabel: 'failed to list users paginated',
      errorMessage: 'Failed to list users',
    }
  );

  return { users, ...meta };
}

/**
 * Active users for form dropdowns. Shared across requests via
 * `unstable_cache` (see `lib/cache/dropdown-cache.ts`); invalidated on
 * user mutations with `updateTag`.
 */
export async function getUserList(): Promise<User[]> {
  return (await getCachedUserList()) as User[];
}

export const createUser = service.createUser;
export const updateUser = service.updateUser;
export const toggleUserActive = service.toggleUserActive;

export type {
  User,
  GetUsersPaginatedResponse,
  CreateUserInput,
  UpdateUserInput,
} from './users.mutations.shared';
