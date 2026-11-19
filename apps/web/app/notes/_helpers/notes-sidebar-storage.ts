/**
 * Notes drafts sidebar open/collapsed preference.
 * Cookie for SSR (avoids flash) + localStorage mirror for client persistence.
 */

import { getLocalStorageItem, setLocalStorageItem } from '@/lib/local-storage';

export const NOTES_SIDEBAR_COOKIE_NAME = 'notes_drafts_sidebar_state';
export const NOTES_SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const LOCAL_STORAGE_KEY = 'alice:notes-drafts-sidebar-open:v1';

export function parseNotesSidebarOpenCookie(
  value: string | undefined
): boolean {
  if (value === undefined) {
    return true;
  }
  return value === 'true';
}

function readLocalStorageOpen(): boolean | null {
  const raw = getLocalStorageItem(LOCAL_STORAGE_KEY);
  if (raw === null) {
    return null;
  }
  return raw === 'true';
}

/** Prefer cookie (SSR), else localStorage, else open. */
export function resolveNotesSidebarOpen(
  cookieValue: string | undefined
): boolean {
  if (cookieValue !== undefined) {
    return parseNotesSidebarOpenCookie(cookieValue);
  }
  const fromLocal = readLocalStorageOpen();
  if (fromLocal !== null) {
    return fromLocal;
  }
  return true;
}

/** Client: persist toggle to cookie + localStorage. */
export function writeNotesSidebarOpen(open: boolean): void {
  if (typeof document !== 'undefined') {
    document.cookie = `${NOTES_SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${NOTES_SIDEBAR_COOKIE_MAX_AGE}`;
  }
  setLocalStorageItem(LOCAL_STORAGE_KEY, open ? 'true' : 'false');
}
