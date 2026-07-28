import { unstable_cache, updateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUser } from '@/lib/auth';

/**
 * Shared Data Cache tags for stable dropdown lists.
 * Invalidated from Server Actions via `updateTag` (read-your-writes).
 */
export const DROPDOWN_CACHE_TAGS = {
  users: 'dropdown-users',
  projects: 'dropdown-projects',
} as const;

export type DropdownCacheTag =
  (typeof DROPDOWN_CACHE_TAGS)[keyof typeof DROPDOWN_CACHE_TAGS];

/** Safety-net TTL (seconds). Mutations invalidate earlier via `updateTag`. */
export const DROPDOWN_CACHE_REVALIDATE_SECONDS = 60;

/**
 * Expire a dropdown cache entry immediately (Server Actions only).
 * Prefer this over `revalidateTag(tag, 'max')` so the mutating user
 * sees fresh options on the next RSC render in the same session.
 */
export function invalidateDropdownCache(tag: DropdownCacheTag): void {
  updateTag(tag);
}

const OWNER_SELECT = 'owner:users!projects_owner_id_fkey(id, name, email)';

/**
 * Cookie-free reads via the service-role client so `unstable_cache` can
 * share one entry across authenticated requests (no `cookies()` inside).
 */
async function fetchActiveUsersForDropdown(): Promise<unknown[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('active', true)
    .order('name', { ascending: true });

  if (error) {
    console.error('error. failed to list cached users:', error.message);
    throw new Error('Failed to list users');
  }

  return data ?? [];
}

async function fetchProjectsForDropdown(): Promise<unknown[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('projects')
    .select(`*, ${OWNER_SELECT}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('error. failed to list cached projects:', error.message);
    throw new Error('Failed to list projects');
  }

  return data ?? [];
}

const getCachedActiveUsers = unstable_cache(
  fetchActiveUsersForDropdown,
  ['dropdown-user-list'],
  {
    revalidate: DROPDOWN_CACHE_REVALIDATE_SECONDS,
    tags: [DROPDOWN_CACHE_TAGS.users],
  }
);

const getCachedProjects = unstable_cache(
  fetchProjectsForDropdown,
  ['dropdown-project-list'],
  {
    revalidate: DROPDOWN_CACHE_REVALIDATE_SECONDS,
    tags: [DROPDOWN_CACHE_TAGS.projects],
  }
);

/** Auth-gated cached active users for form dropdowns. */
export async function getCachedUserList(): Promise<unknown[]> {
  const user = await getUser();
  if (!user) {
    return [];
  }

  return getCachedActiveUsers();
}

/** Auth-gated cached projects for form dropdowns. */
export async function getCachedProjectList(): Promise<unknown[]> {
  const user = await getUser();
  if (!user) {
    return [];
  }

  return getCachedProjects();
}
