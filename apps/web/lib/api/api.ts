type ApiErrorResponse = {
  error: unknown;
};

type TreeifiedError = {
  errors?: string[];
  properties?: Record<string, TreeifiedError | undefined>;
};

function getAPIUrl() {
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

export async function getResponse<T>(
  path: string,
  token: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${getAPIUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...init?.headers,
    },
  });

  const data: T | ApiErrorResponse = await response.json();

  if (!response.ok) {
    const message = getApiErrorMessage(data);
    throw new Error(message);
  }

  return data as T;
}
