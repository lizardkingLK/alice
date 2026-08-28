import { RecordStatusEnum } from '@repo/types';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { getDbUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { paginationMeta } from '@/lib/db/pagination';
import { applyListSearch, runPaginatedSelect } from '@/lib/db/query';
import { isAdmin } from '@/lib/rbac/roles';
import { createAccessAllowlistService } from './access-allowlist.mutations.shared';
import type {
  AccessAllowlistEntry,
  AccessAllowlistListParams,
  AccessAllowlistListResult,
} from './access-allowlist.mutations.shared';

const service = createAccessAllowlistService(apiFetch);

const ALLOWLIST_SEARCH_FIELDS = ['value', 'label'] as const;

/**
 * Reads query Supabase directly from the RSC layer to skip the `web → api`
 * hop. Mutations still go through the API. Admin-only (same as the old GET).
 */
export async function listAccessAllowlist(
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

  const supabase = await createClient();
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

export const createAccessAllowlistEntry = service.createAccessAllowlistEntry;
export const updateAccessAllowlistEntry = service.updateAccessAllowlistEntry;
export const deleteAccessAllowlistEntry = service.deleteAccessAllowlistEntry;

export type {
  AccessAllowlistEntry,
  AccessAllowlistKind,
  AccessAllowlistStatus,
  AccessAllowlistCreateInput,
  AccessAllowlistUpdateInput,
  AccessAllowlistListStatus,
  AccessAllowlistListParams,
  AccessAllowlistListResult,
} from './access-allowlist.mutations.shared';
