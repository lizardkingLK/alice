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

/** Stub `access_allowlist` lookups keyed as `kind:value`, users, and project memberships. */
export function mockAllowlistRows(
  rows: Record<string, AllowlistHit | null>,
  users: Record<string, { id: string } | null> = {},
  projectMemberships: Record<string, { project_id: string }[]> = {}
) {
  createAdminClient.mockImplementation(() => ({
    from: vi.fn((table: string) => {
      const filters: Record<string, string> = {};
      let kind = '';
      let value = '';

      const chain = {
        select: vi.fn(() => chain),
        eq: vi.fn((column: string, next: string) => {
          if (column === 'kind') kind = next;
          if (column === 'value') value = next;
          filters[column] = next;
          return chain;
        }),
        maybeSingle: vi.fn(async () => {
          if (table === 'access_allowlist') {
            const key = `${kind}:${value}`;
            if (!(key in rows)) {
              return { data: null, error: null };
            }
            return { data: rows[key], error: null };
          }
          if (table === 'users') {
            const emailKey = filters['email'] || '';
            const user = users[emailKey];
            return { data: user || null, error: null };
          }
          return { data: null, error: null };
        }),
        then: vi.fn(async (onfulfilled) => { // NOSONAR
          if (table === 'project_members') {
            const userIdKey = filters['user_id'] || '';
            const list = projectMemberships[userIdKey] || [];
            return onfulfilled?.({ data: list, error: null });
          }
          return onfulfilled?.({ data: null, error: null });
        })
      };

      return chain;
    }),
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
