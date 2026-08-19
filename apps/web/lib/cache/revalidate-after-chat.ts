'use server';

import {
  DROPDOWN_CACHE_TAGS,
  invalidateDropdownCache,
} from '@/lib/cache/dropdown-cache';

/** Tool action types emitted by Express `POST /api/chat`. */
export type ChatMutationActionType =
  'create_project' | 'create_sprint' | 'create_work_item';

/**
 * Chat mutations go through Express, not project Server Actions, so they
 * skip `invalidateDropdownCache`. Without this, `/sprints` Create Sprint
 * keeps the cached project list (up to 60s) and omits newly created rows.
 *
 * Do **not** `revalidatePath('/projects')` or `revalidatePath('/work-items')`.
 * Those URLs are `(list)` route groups; Next 16 can cache a 404 for the list
 * page after on-demand revalidate until the dev server restarts.
 * `updateTag` + client `router.refresh()` is enough; Create Sprint also
 * re-reads via `loadProjectsForSprintForm`.
 */
export async function revalidateAfterChatActions(
  actionTypes: readonly ChatMutationActionType[]
): Promise<void> {
  if (actionTypes.includes('create_project')) {
    invalidateDropdownCache(DROPDOWN_CACHE_TAGS.projects);
  }
}
