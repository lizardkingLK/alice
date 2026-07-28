/* eslint-disable no-unused-vars */
import { type Tables } from '@repo/types';

export type AccessAllowlistEntry = Tables<'access_allowlist'>;

export type AccessAllowlistKind = AccessAllowlistEntry['kind'];
export type AccessAllowlistStatus = AccessAllowlistEntry['status'];

export type AccessAllowlistCreateInput = {
  kind: AccessAllowlistKind;
  value: string;
  label?: string | null;
  expires_at?: string | null;
  status?: AccessAllowlistStatus;
};

export type AccessAllowlistUpdateInput = {
  label?: string | null;
  expires_at?: string | null;
  status?: AccessAllowlistStatus;
};

export type AccessAllowlistListStatus =
  'active' | 'inactive' | 'archived' | 'deleted' | 'all';

export type AccessAllowlistListParams = {
  status?: AccessAllowlistListStatus;
  page?: number;
  limit?: number;
  search?: string;
};

export type AccessAllowlistListResult = {
  items: AccessAllowlistEntry[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function createAccessAllowlistService(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
) {
  const apiAccessAllowlist = '/api/accessAllowlist';

  async function listAccessAllowlist(
    params: AccessAllowlistListParams = {}
  ): Promise<AccessAllowlistListResult> {
    const { status = 'active', page = 1, limit = 10, search = '' } = params;

    const query = new URLSearchParams();
    query.set('page', String(page));
    query.set('limit', String(limit));
    if (status && status !== 'active') {
      query.set('status', status);
    }
    if (search) {
      query.set('search', search);
    }

    return await apiFetch<AccessAllowlistListResult>(
      `${apiAccessAllowlist}?${query.toString()}`
    );
  }

  async function createAccessAllowlistEntry(
    input: AccessAllowlistCreateInput
  ): Promise<AccessAllowlistEntry> {
    const data = await apiFetch<{ entry: AccessAllowlistEntry }>(
      apiAccessAllowlist,
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );

    return data.entry;
  }

  async function updateAccessAllowlistEntry(
    id: string,
    input: AccessAllowlistUpdateInput
  ): Promise<AccessAllowlistEntry> {
    const data = await apiFetch<{ entry: AccessAllowlistEntry }>(
      `${apiAccessAllowlist}/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(input),
      }
    );

    return data.entry;
  }

  async function deleteAccessAllowlistEntry(id: string): Promise<void> {
    await apiFetch<{ success: boolean }>(`${apiAccessAllowlist}/${id}`, {
      method: 'DELETE',
    });
  }

  return {
    listAccessAllowlist,
    createAccessAllowlistEntry,
    updateAccessAllowlistEntry,
    deleteAccessAllowlistEntry,
  };
}
