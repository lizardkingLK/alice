import { apiFetch } from '@/lib/api/api-client.server';
import { createAccessAllowlistService } from './accessAllowlist.service.base';

const service = createAccessAllowlistService(apiFetch);

export const listAccessAllowlist = service.listAccessAllowlist;
export const createAccessAllowlistEntry =
  service.createAccessAllowlistEntry;
export const updateAccessAllowlistEntry =
  service.updateAccessAllowlistEntry;
export const deleteAccessAllowlistEntry =
  service.deleteAccessAllowlistEntry;

export type {
  AccessAllowlistEntry,
  AccessAllowlistKind,
  AccessAllowlistStatus,
  AccessAllowlistCreateInput,
  AccessAllowlistUpdateInput,
  AccessAllowlistListStatus,
} from './accessAllowlist.service.base';

