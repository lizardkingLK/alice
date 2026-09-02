import type { AccessRequestKind, AccessRequestStatus } from '@repo/types';

export type AccessRequestEntry = {
  id: string;
  requester_email: string;
  requester_name: string | null;
  message: string;
  kind: AccessRequestKind;
  status: AccessRequestStatus;
  request_count: number;
  requested_project_keys: unknown;
  resolved_by: string | null;
  resolved_at: string | null;
  last_requested_at: string;
  created_at: string;
  updated_at: string;
};

export type AccessRequestListStatus = AccessRequestStatus | 'all';

export type AccessRequestListParams = {
  status?: AccessRequestListStatus;
  page?: number;
  limit?: number;
  search?: string;
};

export type AccessRequestListResult = {
  items: AccessRequestEntry[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function createAccessRequestsService(
  // eslint-disable-next-line no-unused-vars -- structural callback type
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
) {
  const apiAccessRequests = '/api/accessRequests';

  async function denyAccessRequest(requestId: string): Promise<void> {
    await apiFetch<{ success: boolean }>(
      `${apiAccessRequests}/${requestId}/deny`,
      { method: 'POST', body: JSON.stringify({}) }
    );
  }

  return { denyAccessRequest };
}
