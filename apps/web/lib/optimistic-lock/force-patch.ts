type ApiFetchFn = {
  // eslint-disable-next-line no-unused-vars -- generic fetch signature
  <T>(path: string, init?: RequestInit): Promise<T>;
};

/**
 * Force-apply pending fields after Keep mine / merge, sending the server's
 * current `updated_at` as the new optimistic base.
 */
export async function forceOptimisticPatch<TResponse>(
  apiFetch: ApiFetchFn,
  path: string,
  options: {
    readonly pendingFields: Record<string, unknown>;
    readonly expectedUpdatedAt: string;
    readonly method?: 'PUT' | 'PATCH';
  }
): Promise<TResponse> {
  return apiFetch<TResponse>(path, {
    method: options.method ?? 'PUT',
    body: JSON.stringify({
      ...options.pendingFields,
      expectedUpdatedAt: options.expectedUpdatedAt,
    }),
  });
}
