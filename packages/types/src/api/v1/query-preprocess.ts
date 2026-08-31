/** Coerce empty query-string values to `undefined` for optional Zod fields. */
export function emptyToUndefined(value: unknown): unknown {
  if (value === '' || value === undefined || value === null) {
    return undefined;
  }
  return value;
}
