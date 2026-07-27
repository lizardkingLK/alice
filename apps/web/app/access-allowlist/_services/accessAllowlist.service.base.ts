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

export type AccessAllowlistListStatus = 'active' | 'inactive' | 'archived' | 'deleted' | 'all';

export function createAccessAllowlistService(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
) {
  const apiAccessAllowlist = '/api/accessAllowlist';

  async function listAccessAllowlist(
    status: AccessAllowlistListStatus = 'active'
  ): Promise<AccessAllowlistEntry[]> {
    const params = new URLSearchParams();
    if (status && status !== 'active') {
      params.set('status', status);
    }

    const url = params.toString()
      ? `${apiAccessAllowlist}?${params.toString()}`
      : apiAccessAllowlist;

    const data = await apiFetch<{ items: AccessAllowlistEntry[] }>(url);
    return data.items;
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

