import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { createAccessAllowlistService } from './access-allowlist.mutations.shared';

const service = createAccessAllowlistService(apiFetch);

export const createAccessAllowlistEntry = service.createAccessAllowlistEntry;
export const updateAccessAllowlistEntry = service.updateAccessAllowlistEntry;
export const forceUpdateAccessAllowlistEntry =
  service.forceUpdateAccessAllowlistEntry;
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
