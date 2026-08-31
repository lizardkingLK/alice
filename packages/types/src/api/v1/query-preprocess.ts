import { z } from 'zod';

/** Coerce empty query-string values to `undefined` for optional Zod fields. */
export function emptyToUndefined(value: unknown): unknown {
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }
  return value;
}

/** Default paginated list `page` when the query param is missing or empty. */
export function defaultPageNumber(value: unknown): unknown {
  return value === undefined || value === '' ? 1 : value;
}

/** Default paginated list `limit` when the query param is missing or empty. */
export function defaultLimitNumber(value: unknown, defaultLimit = 10): unknown {
  return value === undefined || value === '' ? defaultLimit : value;
}

/** Shared v1 list query `page` field (defaults to 1). */
export const paginatedListPageField = z.preprocess(
  defaultPageNumber,
  z.coerce.number().int().min(1)
);

/** Shared v1 list query `limit` field with configurable default and max. */
export function paginatedListLimitField(defaultLimit = 10, max = 100) {
  return z.preprocess(
    (value) => defaultLimitNumber(value, defaultLimit),
    z.coerce.number().int().min(1).max(max)
  );
}
