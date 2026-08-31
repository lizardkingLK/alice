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

export * from './api/v1/saved-views.js';
