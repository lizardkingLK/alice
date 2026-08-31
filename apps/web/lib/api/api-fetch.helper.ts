import { BackendUnreachableError } from '@/lib/errors/backend-unreachable';
import {
  OPTIMISTIC_LOCK_ERROR_CODE,
  OPTIMISTIC_LOCK_HTTP_STATUS,
  isOptimisticLockConflictBody,
} from '@repo/types';

export { BACKEND_UNREACHABLE_MESSAGE } from '@/lib/errors/backend-unreachable';

type ApiErrorResponse = {
  error: unknown;
  code?: string;
  serverEntity?: unknown;
};

/** Error carrying the HTTP status so callers can branch (e.g. 410 Gone). */
export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly serverEntity?: unknown;

  constructor(
    message: string,
    status: number,
    options?: { code?: string; serverEntity?: unknown }
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = options?.code;
    this.serverEntity = options?.serverEntity;
  }
}

type TreeifiedError = {
  errors?: string[];
  properties?: Record<string, TreeifiedError | undefined>;
};

export function getAPIUrl() {
  // In the browser during `next dev`, call the Next origin so mutations are
  // rewritten to Express. Direct `localhost:5000` fails in a devcontainer
  // when only port 3000 is forwarded (Save view never reaches the API).
  if (
    globalThis.window !== undefined &&
    process.env.NODE_ENV === 'development'
  ) {
    return '';
  }
  return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
}

function isTreeifiedError(value: unknown): value is TreeifiedError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return 'errors' in value || 'properties' in value;
}

function collectTreeifyMessages(node: TreeifiedError, path = ''): string[] {
  const messages: string[] = [];

  for (const error of node.errors ?? []) {
    messages.push(error);
  }

  if (!node.properties) {
    return messages;
  }

  for (const [key, child] of Object.entries(node.properties)) {
    if (!child) {
      continue;
    }

    const nextPath = path ? `${path}.${key}` : key;
    messages.push(...collectTreeifyMessages(child, nextPath));
  }

  return messages;
}

function getApiErrorMessage(data: unknown): string {
  if (typeof data !== 'object' || data === null || !('error' in data)) {
    return 'Request failed. Please try again.';
  }

  const { error } = data;

  if (typeof error === 'string') {
    return error;
  }

  if (isTreeifiedError(error)) {
    const messages = collectTreeifyMessages(error);
    if (messages.length > 0) {
      return messages.join(', ');
    }
  }

  return 'Request failed. Please try again.';
}

function isNetworkConnectivityError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  return (
    message === 'fetch failed' ||
    message.includes('failed to fetch') ||
    message.includes('networkerror') ||
    message.includes('econnrefused') ||
    message.includes('econnreset') ||
    message.includes('enotfound') ||
    message.includes('socket hang up') ||
    name === 'aborterror' ||
    name === 'timeouterror'
  );
}

const FETCH_TIMEOUT_MS = 20_000;

export type GetResponseInit = RequestInit & {
  /**
   * Overrides the default 20s abort. Long-running calls (chat Gemini tool
   * loops, Jira import) pass a higher `timeoutMs`.
   */
  timeoutMs?: number;
};

function mergeAbortSignals(
  timeoutMs: number,
  external?: AbortSignal | null
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!external) {
    return timeout;
  }
  return AbortSignal.any([timeout, external]);
}

export async function getResponse<T>(
  path: string,
  token: string,
  init?: GetResponseInit
): Promise<T> {
  const apiUrl = getAPIUrl();
  // `''` is same-origin in `next dev` (rewritten to Express). Do not treat it
  // as missing — `!''` is true and was aborting Save view immediately.
  if (apiUrl == null) {
    throw new BackendUnreachableError();
  }

  const { timeoutMs = FETCH_TIMEOUT_MS, ...fetchInit } = init ?? {};

  const headers = new Headers(fetchInit.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const isFormData =
    typeof FormData !== 'undefined' && fetchInit.body instanceof FormData;

  // Let the browser set multipart boundary for FormData uploads.
  if (isFormData) {
    headers.delete('Content-Type');
  } else if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      cache: 'no-store',
      ...fetchInit,
      headers,
      signal: mergeAbortSignals(timeoutMs, fetchInit.signal),
    });
  } catch (error) {
    if (isNetworkConnectivityError(error)) {
      throw new BackendUnreachableError();
    }
    throw error;
  }

  let data: T | ApiErrorResponse;
  try {
    data = (await response.json()) as T | ApiErrorResponse;
  } catch {
    if (!response.ok) {
      throw new BackendUnreachableError();
    }
    throw new Error('Request failed. Please try again.');
  }

  if (!response.ok) {
    const message = getApiErrorMessage(data);
    if (
      response.status === OPTIMISTIC_LOCK_HTTP_STATUS &&
      isOptimisticLockConflictBody(data)
    ) {
      throw new ApiError(message, response.status, {
        code: OPTIMISTIC_LOCK_ERROR_CODE,
        serverEntity: data.serverEntity,
      });
    }
    throw new ApiError(message, response.status);
  }

  return data as T;
}
