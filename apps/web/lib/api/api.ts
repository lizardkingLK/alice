type ApiErrorResponse = {
  error: unknown;
};

function getAPIUrl() {
  return process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL;
}

function getApiErrorMessage(data: unknown): string {
  if (typeof data !== 'object' || data === null || !('error' in data)) {
    return 'Request failed. Please try again.';
  }

  const { error } = data;

  return typeof error === 'string'
    ? error
    : 'Request failed. Please try again.';
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
