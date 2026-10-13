/**
 * Project details secondary sidebar open/collapsed preference.
 * Cookie for SSR (no flash); localStorage mirrors the same boolean per user.
 */

import { createBooleanLocalPreference } from '@/lib/local-preference/create-boolean-local-preference';

export const PROJECT_DETAILS_SIDEBAR_COOKIE_NAME =
  'project_details_sidebar_state';
export const PROJECT_DETAILS_SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

const projectDetailsSidebarLocalPreference = createBooleanLocalPreference({
  storagePrefix: 'alice:project-details-sidebar-open:v1:',
  defaultValue: true,
});

export const projectDetailsSidebarOpenStorageKey =
  projectDetailsSidebarLocalPreference.storageKey;

export const readProjectDetailsSidebarOpenLocal =
  projectDetailsSidebarLocalPreference.read;

export const writeProjectDetailsSidebarOpenLocal =
  projectDetailsSidebarLocalPreference.write;

export function parseProjectDetailsSidebarOpenCookie(
  value: string | undefined
): boolean {
  if (value === undefined) {
    return true;
  }
  return value === 'true';
}

/** Client: persist toggle so the next SSR paint matches. */
export function writeProjectDetailsSidebarOpenCookie(open: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${PROJECT_DETAILS_SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${PROJECT_DETAILS_SIDEBAR_COOKIE_MAX_AGE}`;
}

/** Write cookie + localStorage together. */
export function persistProjectDetailsSidebarOpen(
  userId: string | null | undefined,
  open: boolean
): void {
  writeProjectDetailsSidebarOpenCookie(open);
  writeProjectDetailsSidebarOpenLocal(userId, open);
}
