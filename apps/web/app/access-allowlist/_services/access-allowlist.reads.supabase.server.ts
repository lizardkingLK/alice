import { RecordStatusEnum } from '@repo/types';
import { getDbUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { paginationMeta } from '@/lib/db/pagination';
import { applyListSearch, runPaginatedSelect } from '@/lib/db/query';
import { isAdmin } from '@/lib/rbac/roles';
import type {
  AccessAllowlistEntry,
  AccessAllowlistListParams,
  AccessAllowlistListResult,
} from './access-allowlist.mutations.shared';

const ALLOWLIST_SEARCH_FIELDS = ['value', 'label'] as const;

/**
 * Admin-only RSC list. Uses the service-role client because `access_allowlist`
 * is PostgREST-locked (RLS + revoke for anon/authenticated). Mutations stay on
 * the API. See docs/guides/RLS_HYBRID_ROLLOUT.md.
 */
export async function listAccessAllowlistFromSupabase(
  params: AccessAllowlistListParams = {}
): Promise<AccessAllowlistListResult> {
  const {
    status = RecordStatusEnum.active,
    page = 1,
    limit = 10,
    search,
  } = params;

  const dbUser = await getDbUser();
  if (!isAdmin(dbUser?.role)) {
    return { items: [], ...paginationMeta(0, page, limit) };
  }

  const supabase = createAdminClient();
  let query = supabase.from('access_allowlist').select('*', { count: 'exact' });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  query = applyListSearch(query, search, [...ALLOWLIST_SEARCH_FIELDS]);

  const { rows: items, ...meta } =
    await runPaginatedSelect<AccessAllowlistEntry>(query, page, limit, {
      orderBy: 'created_at',
      logLabel: 'failed to list access allowlist',
      errorMessage: 'Failed to list access allowlist',
    });

  return { items, ...meta };
}

/**
 * All domain allowlist rows (any status, not paginated). Used by access-request
 * grant UI for covering-domain / renew-before-grant.
 */
export async function listAllowlistDomainEntriesFromSupabase(): Promise<
  AccessAllowlistEntry[]
> {
  const dbUser = await getDbUser();
  if (!isAdmin(dbUser?.role)) {
    return [];
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('access_allowlist')
    .select('*')
    .eq('kind', 'domain')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('failed to list allowlist domains:', error.message);
    return [];
  }

  return (data ?? []) as AccessAllowlistEntry[];
}
