import { apiFetch } from '@/lib/api/api-client';
import {
  buildSavedViewHref,
  normalizeSavedViewSearch,
  type Tables,
} from '@repo/types';

export type SavedView = Tables<'saved_views'>;

export type CreateSavedViewClientInput = {
  readonly title: string;
  readonly description?: string | null;
  readonly pathname: string;
  readonly search: string;
  readonly projectId?: string | null;
};

export { buildSavedViewHref, normalizeSavedViewSearch };

/** Mutations only — list reads use `saved-views.service.server.ts` (SSR). */
export async function createSavedView(
  input: CreateSavedViewClientInput
): Promise<SavedView> {
  const response = await apiFetch<{ data: SavedView }>('/api/saved-views', {
    method: 'POST',
    body: JSON.stringify({
      title: input.title,
      description: input.description ?? null,
      pathname: input.pathname,
      search: normalizeSavedViewSearch(input.search),
      projectId: input.projectId ?? null,
    }),
  });
  return response.data;
}

export async function archiveSavedView(id: string): Promise<SavedView> {
  const response = await apiFetch<{ data: SavedView }>(
    `/api/saved-views/${id}/archive`,
    { method: 'POST' }
  );
  return response.data;
}

/** Remove a view from Shared with me (deletes the recipient’s share row only). */
export async function deleteSharedView(id: string): Promise<void> {
  await apiFetch<{ success: true }>(`/api/saved-views/${id}/share`, {
    method: 'DELETE',
  });
}

export async function restoreSavedView(id: string): Promise<SavedView> {
  const response = await apiFetch<{ data: SavedView }>(
    `/api/saved-views/${id}/restore`,
    { method: 'POST' }
  );
  return response.data;
}

export async function deleteSavedView(id: string): Promise<void> {
  await apiFetch<{ success: true }>(`/api/saved-views/${id}`, {
    method: 'DELETE',
  });
}

export type ShareSavedViewClientInput = {
  readonly userIds: readonly string[];
};

export async function shareSavedView(
  id: string,
  input: ShareSavedViewClientInput
): Promise<{ view: SavedView; recipientCount: number }> {
  const response = await apiFetch<{
    data: { view: SavedView; recipientCount: number };
  }>(`/api/saved-views/${id}/share`, {
    method: 'POST',
    body: JSON.stringify({ userIds: input.userIds }),
  });
  return response.data;
}
