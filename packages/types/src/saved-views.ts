import { z } from 'zod';

/** Strip leading `?` and normalize empty search. */
export function normalizeSavedViewSearch(search: string): string {
  const trimmed = search.trim();
  if (!trimmed) {
    return '';
  }
  return trimmed.startsWith('?') ? trimmed.slice(1) : trimmed;
}

export function buildSavedViewHref(pathname: string, search: string): string {
  const normalizedSearch = normalizeSavedViewSearch(search);
  return normalizedSearch ? `${pathname}?${normalizedSearch}` : pathname;
}

/** Columns used by owned / shared saved-view list search (API + SSR). */
export const SAVED_VIEW_LIST_SEARCH_FIELDS = [
  'title',
  'description',
  'pathname',
] as const;

/** Deduplicate share rows to view ids (active-share → active-view reads). */
export function uniqueSavedViewIdsFromShares(
  shares: ReadonlyArray<{ readonly view_id: string }>
): string[] {
  return [...new Set(shares.map((row) => row.view_id))];
}

export const createSavedViewSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  pathname: z.string().trim().min(1).max(500),
  search: z.string().max(2000).optional().default(''),
  projectId: z.uuid().nullable().optional(),
});

export type CreateSavedViewInput = z.infer<typeof createSavedViewSchema>;

export const updateSavedViewSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
});

export type UpdateSavedViewInput = z.infer<typeof updateSavedViewSchema>;

/** Explicit recipient user ids (owner excluded server-side). */
export const shareSavedViewSchema = z.object({
  userIds: z.array(z.uuid()).min(1),
});

export type ShareSavedViewInput = z.infer<typeof shareSavedViewSchema>;

/** Unique recipient ids excluding the owner. */
export function expandShareRecipients(params: {
  readonly ownerId: string;
  readonly candidateIds: readonly string[];
}): string[] {
  const unique = new Set<string>();
  for (const id of params.candidateIds) {
    if (id && id !== params.ownerId) {
      unique.add(id);
    }
  }
  return [...unique];
}
