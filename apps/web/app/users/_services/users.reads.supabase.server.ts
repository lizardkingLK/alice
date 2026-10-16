import { createClient } from '@/lib/supabase/server';
import {
  applyListSearch,
  runPaginatedSelect,
  throwIfError,
} from '@/lib/db/query';
import type { GetUsersPaginatedResponse, User } from './users.mutations.shared';
import { filterProductUsableUsers } from '@repo/types';

/**
 * Supabase-js RSC reads (default). The facade in `users.reads.server.ts`
 * picks this or the Express twin for the paginated list.
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

export async function getUsersListPaginatedFromSupabase(
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

/** Product-usable admins (active kill switch + active membership). */
export async function getActiveAdminCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await filterProductUsableUsers(
    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('role', 'admin')
  );

  throwIfError(
    error,
    'failed to count active admins',
    'Failed to count active admins'
  );

  return count ?? 0;
}
