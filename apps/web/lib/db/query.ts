import { pageRange, paginationMeta, type PaginationMeta } from './pagination';

/**
 * Small, client-agnostic helpers shared by the RSC data services so each
 * paginated list query doesn't re-implement the same search / error-handling
 * boilerplate. These operate structurally on the Supabase query builder, so
 * they work with any typed `SupabaseClient` without leaking its generics.
 */

// Structural shape of the Supabase builder's `.or()`. The param name is only
// part of the type signature (no runtime binding), so no-unused-vars is moot.
/* eslint-disable no-unused-vars */
interface OrSearchable<Q> {
  or(filters: string): Q;
}
/* eslint-enable no-unused-vars */

/** Applies a case-insensitive `ILIKE` OR-search across the given columns. */
export function applyListSearch<Q extends OrSearchable<Q>>(
  query: Q,
  search: string | undefined,
  columns: readonly string[]
): Q {
  if (!search) {
    return query;
  }

  const sanitized = `%${search}%`;
  const expression = columns
    .map((column) => `${column}.ilike.${sanitized}`)
    .join(',');

  return query.or(expression);
}

export type PaginatedSelectResult<TRow> = {
  rows: TRow[];
} & PaginationMeta;

export type RunPaginatedSelectOptions = {
  orderBy: string;
  ascending?: boolean;
  logLabel: string;
  errorMessage: string;
};

/**
 * PostgREST builders chain `.order()` then `.range()`, and `range()` is thenable.
 * Keep this structural so RSC readers stay free of `SupabaseClient` generics.
 */
/* eslint-disable no-unused-vars */
interface PaginatedSelectBuilder {
  order(
    column: string,
    options?: { ascending?: boolean }
  ): {
    range(
      from: number,
      to: number
    ): PromiseLike<{
      data: unknown;
      error: { message: string } | null;
      count: number | null;
    }>;
  };
}
/* eslint-enable no-unused-vars */

/**
 * Shared page slice: order + range + count meta + `throwIfError`.
 * Callers apply table-specific filters first, then map `rows` to their DTO key.
 */
export async function runPaginatedSelect<TRow>(
  query: PaginatedSelectBuilder,
  page: number,
  limit: number,
  options: RunPaginatedSelectOptions
): Promise<PaginatedSelectResult<TRow>> {
  const { from, to } = pageRange(page, limit);
  const { data, error, count } = await query
    .order(options.orderBy, { ascending: options.ascending ?? false })
    .range(from, to);

  throwIfError(error, options.logLabel, options.errorMessage);

  return {
    rows: (data ?? []) as TRow[],
    ...paginationMeta(count ?? 0, page, limit),
  };
}

/** Logs (with the repo `error. <label>:` prefix) and throws when a query fails. */
export function throwIfError(
  error: { message: string } | null,
  logLabel: string,
  errorMessage: string
): void {
  if (error) {
    console.error(`error. ${logLabel}:`, error.message);
    throw new Error(errorMessage);
  }
}

/** Seed a count map with `0` for every id (batch badge / group-by helpers). */
export function zeroCountsById(ids: readonly string[]): Record<string, number> {
  return Object.fromEntries(ids.map((id) => [id, 0]));
}

/**
 * Increment counts for each non-null key. Keys missing from `counts` start at 0.
 * Mutates and returns `counts` for convenient chaining after a batch select.
 */
export function aggregateCountsByKey(
  counts: Record<string, number>,
  keys: readonly (string | null | undefined)[]
): Record<string, number> {
  for (const key of keys) {
    if (!key) {
      continue;
    }
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/** True when PostgREST/Supabase cannot see a table or relation yet. */
export function isMissingRelationError(error: {
  message?: string;
  code?: string;
}): boolean {
  const message = error.message?.toLowerCase() ?? '';
  const code = error.code ?? '';

  return (
    code === 'PGRST205' ||
    message.includes('schema cache') ||
    message.includes('could not find the table') ||
    (message.includes('relation') && message.includes('does not exist'))
  );
}
