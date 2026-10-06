'use server';

import {
  DROPDOWN_CACHE_TAGS,
  invalidateDropdownCache,
} from '@/lib/cache/dropdown-cache';

/** Expire project options after a project is created through the Express API. */
export async function invalidateProjectDropdownCache(): Promise<void> {
  invalidateDropdownCache(DROPDOWN_CACHE_TAGS.projects);
}
