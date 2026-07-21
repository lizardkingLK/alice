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
