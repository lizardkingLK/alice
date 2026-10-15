import { cookies } from 'next/headers';
import {
  DEFAULT_WORK_ITEM_DETAILS_PREFERENCES,
  WORK_ITEM_DETAILS_PREFS_COOKIE,
  normalizeWorkItemDetailsPreferences,
  parseWorkItemDetailsPreferencesCookie,
  type WorkItemDetailsPreferences,
} from '@/app/work-items/_helpers/work-item-details-preferences';

export type WorkItemDetailsPreferencesBootstrap = {
  readonly preferences: WorkItemDetailsPreferences;
  /** When false, client should hydrate from localStorage before relying on prefs. */
  readonly hasCookie: boolean;
};

/**
 * Server-readable details prefs so the banner can SSR without a tint/icon flash.
 */
export async function readWorkItemDetailsPreferencesBootstrap(): Promise<WorkItemDetailsPreferencesBootstrap> {
  const jar = await cookies();
  const raw = jar.get(WORK_ITEM_DETAILS_PREFS_COOKIE)?.value;
  if (!raw) {
    return {
      preferences: normalizeWorkItemDetailsPreferences(
        DEFAULT_WORK_ITEM_DETAILS_PREFERENCES
      ),
      hasCookie: false,
    };
  }

  return {
    preferences: parseWorkItemDetailsPreferencesCookie(raw),
    hasCookie: true,
  };
}
