import { parseWithZod } from '@/lib/zod/format-zod-error';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import {
  createSavedViewBodySchema,
  shareSavedViewBodySchema,
  type SavedViewMutationResponse,
  type SavedViewSuccessResponse,
  type SavedViewWire,
  type ShareSavedViewResponse,
} from '@repo/types/api/v1';
import { normalizeSavedViewSearch } from '@repo/types';

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

async function postSavedViewMutation(subpath: string): Promise<SavedView> {
  const response = await apiFetch<SavedViewMutationResponse>(
    `${savedViewsPath}${subpath}`,
    { method: 'POST' }
  );
  return response.data;
}

async function deleteSavedViewMutation(subpath: string): Promise<void> {
  await apiFetch<SavedViewSuccessResponse>(`${savedViewsPath}${subpath}`, {
    method: 'DELETE',
  });
}

/** Mutations only — list reads use `saved-views.reads.server.ts` (SSR). */
export async function createSavedView(
  input: CreateSavedViewClientInput
): Promise<SavedView> {
  const body = parseWithZod(createSavedViewBodySchema, {
    title: input.title,
    description: input.description ?? null,
    pathname: input.pathname,
    search: normalizeSavedViewSearch(input.search),
    projectId: input.projectId ?? null,
  });

  const response = await apiFetch<SavedViewMutationResponse>(savedViewsPath, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return response.data;
}

export async function archiveSavedView(id: string): Promise<SavedView> {
  return postSavedViewMutation(`/${id}/archive`);
}

/** Remove a view from Shared with me (deletes the recipient’s share row only). */
export async function deleteSharedView(id: string): Promise<void> {
  await deleteSavedViewMutation(`/${id}/share`);
}

export async function restoreSavedView(id: string): Promise<SavedView> {
  return postSavedViewMutation(`/${id}/restore`);
}

export async function deleteSavedView(id: string): Promise<void> {
  await deleteSavedViewMutation(`/${id}`);
}

export type ShareSavedViewClientInput = {
  readonly userIds: readonly string[];
};

export async function shareSavedView(
  id: string,
  input: ShareSavedViewClientInput
): Promise<ShareSavedViewResponse['data']> {
  const body = parseWithZod(shareSavedViewBodySchema, {
    userIds: input.userIds,
  });

  const response = await apiFetch<ShareSavedViewResponse>(
    `${savedViewsPath}/${id}/share`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    }
  );
  return response.data;
}
