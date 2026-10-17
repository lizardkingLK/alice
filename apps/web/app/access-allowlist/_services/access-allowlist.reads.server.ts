import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { shouldReadViaApi } from '@/lib/data-retrieval.server';
import { listAccessAllowlistFromApi } from './access-allowlist.reads.api.server';
import { listAccessAllowlistFromSupabase } from './access-allowlist.reads.supabase.server';
import { createAccessAllowlistService } from './access-allowlist.mutations.shared';
import type {
  AccessAllowlistListParams,
  AccessAllowlistListResult,
} from './access-allowlist.mutations.shared';

const service = createAccessAllowlistService(apiFetch);

/**
 * Public server read facade — picks supabase-js (default) or Express GET
 * based on `DATA_READS_VIA_API`. Admin-only on both paths: Supabase reader
 * short-circuits to an empty page for non-admins, Express answers 403.
 * Mutations go through the API (`service`).
 */
export async function listAccessAllowlist(
  params: AccessAllowlistListParams = {}
): Promise<AccessAllowlistListResult> {
  if (shouldReadViaApi('access-allowlist')) {
    return listAccessAllowlistFromApi(params);
  }

  return listAccessAllowlistFromSupabase(params);
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
