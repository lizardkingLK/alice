/* eslint-disable no-unused-vars */
import { type RecordStatus, type Tables } from '@repo/types';
import { forceOptimisticPatch } from '@/lib/optimistic-lock/force-patch';

export type AccessAllowlistEntry = Tables<'access_allowlist'>;

export type AccessAllowlistKind = AccessAllowlistEntry['kind'];
export type AccessAllowlistStatus = AccessAllowlistEntry['status'];

export type AccessAllowlistCreateInput = {
  kind: AccessAllowlistKind;
  value: string;
  label?: string | null;
  expires_at?: string | null;
  allowed_project_ids?: string[] | null;
  status?: AccessAllowlistStatus;
};

export type AccessAllowlistUpdateInput = {
  label?: string | null;
  expires_at?: string | null;
  allowed_project_ids?: string[] | null;
  status?: AccessAllowlistStatus;
};

export type AccessAllowlistListStatus = RecordStatus | 'all';

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
    input: AccessAllowlistUpdateInput,
    expectedUpdatedAt: string
  ): Promise<AccessAllowlistEntry> {
    const data = await apiFetch<{ entry: AccessAllowlistEntry }>(
      `${apiAccessAllowlist}/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify({ ...input, expectedUpdatedAt }),
      }
    );

    return data.entry;
  }

  async function forceUpdateAccessAllowlistEntry(
    id: string,
    pendingFields: Record<string, unknown>,
    expectedUpdatedAt: string
  ): Promise<AccessAllowlistEntry> {
    const data = await forceOptimisticPatch<{ entry: AccessAllowlistEntry }>(
      apiFetch,
      `${apiAccessAllowlist}/${id}`,
      { pendingFields, expectedUpdatedAt }
    );

    return data.entry;
  }

  async function deleteAccessAllowlistEntry(
    id: string,
    expectedUpdatedAt: string
  ): Promise<void> {
    await apiFetch<{ success: boolean }>(`${apiAccessAllowlist}/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ expectedUpdatedAt }),
    });
  }

  return {
    createAccessAllowlistEntry,
    updateAccessAllowlistEntry,
    forceUpdateAccessAllowlistEntry,
    deleteAccessAllowlistEntry,
  };
}
