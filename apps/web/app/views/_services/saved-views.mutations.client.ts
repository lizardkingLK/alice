import { normalizeSavedViewSearch } from '@repo/types';
import { formatZodError } from '@/lib/zod/format-zod-error';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import {
  createSavedViewBodySchema,
  shareSavedViewBodySchema,
  type SavedViewMutationResponse,
  type SavedViewSuccessResponse,
  type SavedViewWire,
  type ShareSavedViewResponse,
} from '@repo/types/api/v1';

export type SavedView = SavedViewWire;

export type CreateSavedViewClientInput = {
  readonly title: string;
  readonly description?: string | null;
  readonly pathname: string;
  readonly search: string;
  readonly projectId?: string | null;
};

export { buildSavedViewHref, normalizeSavedViewSearch } from '@repo/types';

const savedViewsPath = '/api/v1/saved-views';

/** Mutations only — list reads use `saved-views.reads.server.ts` (SSR). */
export async function createSavedView(
  input: CreateSavedViewClientInput
): Promise<SavedView> {
  const parsed = createSavedViewBodySchema.safeParse({
    title: input.title,
    description: input.description ?? null,
    pathname: input.pathname,
    search: normalizeSavedViewSearch(input.search),
    projectId: input.projectId ?? null,
  });
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }

  const response = await apiFetch<SavedViewMutationResponse>(savedViewsPath, {
    method: 'POST',
    body: JSON.stringify(parsed.data),
  });
  return response.data;
}

export async function archiveSavedView(id: string): Promise<SavedView> {
  const response = await apiFetch<SavedViewMutationResponse>(
    `${savedViewsPath}/${id}/archive`,
    { method: 'POST' }
  );
  return response.data;
}

/** Remove a view from Shared with me (deletes the recipient’s share row only). */
export async function deleteSharedView(id: string): Promise<void> {
  await apiFetch<SavedViewSuccessResponse>(`${savedViewsPath}/${id}/share`, {
    method: 'DELETE',
  });
}

export async function restoreSavedView(id: string): Promise<SavedView> {
  const response = await apiFetch<SavedViewMutationResponse>(
    `${savedViewsPath}/${id}/restore`,
    { method: 'POST' }
  );
  return response.data;
}

export async function deleteSavedView(id: string): Promise<void> {
  await apiFetch<SavedViewSuccessResponse>(`${savedViewsPath}/${id}`, {
    method: 'DELETE',
  });
}

export type ShareSavedViewClientInput = {
  readonly userIds: readonly string[];
};

export async function shareSavedView(
  id: string,
  input: ShareSavedViewClientInput
): Promise<ShareSavedViewResponse['data']> {
  const parsed = shareSavedViewBodySchema.safeParse({
    userIds: input.userIds,
  });
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }

  const response = await apiFetch<ShareSavedViewResponse>(
    `${savedViewsPath}/${id}/share`,
    {
      method: 'POST',
      body: JSON.stringify(parsed.data),
    }
  );
  return response.data;
}
