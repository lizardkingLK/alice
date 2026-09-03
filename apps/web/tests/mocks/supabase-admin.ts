import { vi, type Mock } from 'vitest';
import { RecordStatusEnum } from '@repo/types';

export const createAdminClient: Mock = vi.fn();

export type AllowlistHit = {
  expires_at: string | null;
  status?: string;
  allowed_project_ids?: unknown;
};

type QueryResult = { data: unknown; error: unknown };

type QueryContext = {
  kind: string;
  value: string;
  filters: Record<string, string>;
};

type SupabaseQueryChain = Promise<QueryResult> & {
  select: Mock;
  eq: Mock;
  maybeSingle: Mock;
};

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

function createAwaitableQueryChain(
  // eslint-disable-next-line no-unused-vars
  resolveQuery: (context: QueryContext) => QueryResult | Promise<QueryResult>
): SupabaseQueryChain {
  const context: QueryContext = { kind: '', value: '', filters: {} };

  const createChain = (): SupabaseQueryChain => {
    const promise = Promise.resolve().then(() => resolveQuery(context));
    return Object.assign(promise, {
      select: vi.fn(() => createChain()),
      eq: vi.fn((column: string, next: string) => {
        if (column === 'kind') context.kind = next;
        if (column === 'value') context.value = next;
        context.filters[column] = next;
        return createChain();
      }),
      maybeSingle: vi.fn(() =>
        Promise.resolve().then(() => resolveQuery(context))
      ),
    });
  };

  return createChain();
}

function normalizeAllowlistRow(hit: AllowlistHit | null) {
  if (!hit) {
    return null;
  }

  return {
    status: hit.status ?? RecordStatusEnum.active,
    expires_at: hit.expires_at,
    allowed_project_ids: hit.allowed_project_ids ?? null,
  };
}

/** Stub `access_allowlist` lookups keyed as `kind:value`, users, and projects. */
export function mockAllowlistRows(
  rows: Record<string, AllowlistHit | null>,
  users: Record<string, { id: string } | null> = {},
  projects: Array<{ id: string; key: string }> = []
) {
  createAdminClient.mockImplementation(() => ({
    from: vi.fn((table: string) =>
      createAwaitableQueryChain((context) => {
        if (table === 'access_allowlist') {
          const key = `${context.kind}:${context.value}`;
          if (!(key in rows)) {
            return { data: null, error: null };
          }
          return {
            data: normalizeAllowlistRow(rows[key] ?? null),
            error: null,
          };
        }

        if (table === 'users') {
          const emailKey = context.filters['email'] || '';
          const user = users[emailKey];
          return { data: user || null, error: null };
        }

        if (table === 'projects') {
          return { data: projects, error: null };
        }

        return { data: null, error: null };
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
