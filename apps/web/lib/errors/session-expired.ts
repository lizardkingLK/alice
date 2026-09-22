/**
 * Thrown from client `apiFetch` when the Supabase session is missing/expired
 * (or the API returns 401). Do **not** call Next `redirect()` from client
 * fetch helpers — that surfaces as a cryptic NEXT_REDIRECT error in UI.
 */
export const SESSION_EXPIRED_MESSAGE =
  'Your session has expired. Please sign in again.';

export const SESSION_EXPIRED_EVENT = 'alice:session-expired';

export class SessionExpiredError extends Error {
  readonly loginPath: string;

  constructor(loginPath: string, message: string = SESSION_EXPIRED_MESSAGE) {
    super(message);
    this.name = 'SessionExpiredError';
    this.loginPath = loginPath;
  }
}

export function isSessionExpiredError(
  error: unknown
): error is SessionExpiredError {
  if (error instanceof SessionExpiredError) {
    return true;
  }
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    error.name === 'SessionExpiredError' ||
    error.message === SESSION_EXPIRED_MESSAGE
  );
}

export type SessionExpiredEventDetail = {
  readonly loginPath: string;
};

/** Notify dashboard UI to open the session-expired dialog (client only). */
export function emitSessionExpired(loginPath: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<SessionExpiredEventDetail>(SESSION_EXPIRED_EVENT, {
      detail: { loginPath },
    })
  );
}
