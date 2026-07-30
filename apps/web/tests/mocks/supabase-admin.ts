import { vi, type Mock } from 'vitest';

export const createAdminClient: Mock = vi.fn();

export type AllowlistHit = { expires_at: string | null };

type QueryResult = { data: unknown; error: unknown };

/* eslint-disable no-unused-vars -- structural callback types for the query stub */
function createAllowlistQueryChain(options: {
  resolve?: (kind: string, value: string) => Promise<QueryResult> | QueryResult;
  fixed?: QueryResult;
}) {
  /* eslint-enable no-unused-vars */
  let kind = '';
  let value = '';

  const chain = {
    select: vi.fn(() => chain),
    eq: vi.fn((column: string, next: string) => {
      if (column === 'kind') kind = next;
      if (column === 'value') value = next;
      return chain;
    }),
    maybeSingle: vi.fn(async () => {
      if (options.fixed) {
        return options.fixed;
      }

      return (
        (await options.resolve?.(kind, value)) ?? {
          data: null,
          error: null,
        }
      );
    }),
  };

  return chain;
}

/** Stub `access_allowlist` lookups keyed as `kind:value`. */
export function mockAllowlistRows(rows: Record<string, AllowlistHit | null>) {
  createAdminClient.mockImplementation(() => ({
    from: vi.fn(() =>
      createAllowlistQueryChain({
        resolve: (kind, value) => {
          const key = `${kind}:${value}`;
          if (!(key in rows)) {
            return { data: null, error: null };
          }
          return { data: rows[key], error: null };
        },
      })
    ),
  }));
}

/** Force every allowlist lookup to fail with a Supabase-style error. */
export function mockAllowlistLookupError(message = 'db down') {
  createAdminClient.mockImplementation(() => ({
    from: vi.fn(() =>
      createAllowlistQueryChain({
        fixed: { data: null, error: { message } },
      })
    ),
  }));
}
