/**
 * Chat history sidebar open/collapsed preference.
 * Cookie-backed (same pattern as the dashboard `sidebar_state` cookie) so the
 * server can pass the correct initial state and avoid a client flash.
 */

export const CHAT_HISTORY_SIDEBAR_COOKIE_NAME = 'chat_history_sidebar_state';
export const CHAT_HISTORY_SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

export function parseChatHistorySidebarOpenCookie(
  value: string | undefined
): boolean {
  if (value === undefined) {
    return true;
  }
  return value === 'true';
}

/** Client: persist toggle so the next SSR paint matches. */
export function writeChatHistorySidebarOpenCookie(open: boolean): void {
  if (typeof document === 'undefined') {
    return;
  }
  document.cookie = `${CHAT_HISTORY_SIDEBAR_COOKIE_NAME}=${open}; path=/; max-age=${CHAT_HISTORY_SIDEBAR_COOKIE_MAX_AGE}`;
}
