import { BackendUnreachableError } from '@/lib/errors/backend-unreachable';

export { BACKEND_UNREACHABLE_MESSAGE } from '@/lib/errors/backend-unreachable';

type ApiErrorResponse = {
  error: unknown;
};

type TreeifiedError = {
  errors?: string[];
  properties?: Record<string, TreeifiedError | undefined>;
};

export function getAPIUrl() {
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

export async function getResponse<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const apiUrl = getAPIUrl();
  if (!apiUrl) {
    throw new BackendUnreachableError();
  }

  const headers = new Headers(init?.headers);
  headers.set('Authorization', `Bearer ${token}`);

  const isFormData =
    typeof FormData !== 'undefined' && init?.body instanceof FormData;

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
      ...init,
      headers,
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
    throw new Error(message);
  }

  return data as T;
}
