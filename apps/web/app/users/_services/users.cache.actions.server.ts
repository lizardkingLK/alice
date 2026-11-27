'use server';

import {
  DROPDOWN_CACHE_TAGS,
  invalidateDropdownCache,
} from '@/lib/cache/dropdown-cache';

/** Expire user options after a user is created (e.g. project quick-create). */
export async function invalidateUserDropdownCache(): Promise<void> {
  await Promise.resolve().then(() =>
    invalidateDropdownCache(DROPDOWN_CACHE_TAGS.users)
  );
}
