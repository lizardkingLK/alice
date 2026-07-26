/**
 * Thrown when the web app cannot reach the Express API (network / process down).
 * Message is stable — Next.js error boundaries only receive `message` + `digest`
 * on the client, so UI detects this via the message string.
 */
export const BACKEND_UNREACHABLE_MESSAGE = 'Could not connect to the backend.';

export class BackendUnreachableError extends Error {
  constructor(message: string = BACKEND_UNREACHABLE_MESSAGE) {
    super(message);
    this.name = 'BackendUnreachableError';
  }
}

export function isBackendUnreachableError(error: unknown): boolean {
  if (error instanceof BackendUnreachableError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.name === 'BackendUnreachableError' ||
    error.message === BACKEND_UNREACHABLE_MESSAGE ||
    error.message.startsWith(BACKEND_UNREACHABLE_MESSAGE)
  );
}
