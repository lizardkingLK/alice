import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { getCachedUserList } from '@/lib/cache/dropdown-cache';
import { shouldReadViaApi } from '@/lib/data-retrieval.server';
import { getUsersListPaginatedFromApi } from './users.reads.api.server';
import { getUsersListPaginatedFromSupabase } from './users.reads.supabase.server';
import { createUsersService } from './users.mutations.shared';
import type { GetUsersPaginatedResponse, User } from './users.mutations.shared';

const service = createUsersService(apiFetch);

export {
  getActiveAdminCount,
  getUsersList,
} from './users.reads.supabase.server';

/**
 * Public server read facade — picks supabase-js (default) or Express GET
 * based on `DATA_READS_VIA_API`. Mutations (create/update/toggle) go through
 * the API (`service`).
 */
export async function getUsersListPaginated(
  page: number,
  limit: number,
  search = ''
): Promise<GetUsersPaginatedResponse> {
  if (shouldReadViaApi('users')) {
    return getUsersListPaginatedFromApi(page, limit, search);
  }

  return getUsersListPaginatedFromSupabase(page, limit, search);
}

/**
 * Active users for form dropdowns. Shared across requests via
 * `unstable_cache` (see `lib/cache/dropdown-cache.ts`); invalidated on
 * user mutations with `updateTag`. Supabase-only (no Express twin).
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
