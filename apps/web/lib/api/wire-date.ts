/** Normalize Express JSON dates (ISO strings or `Date`) to an ISO string. */
export function asIso(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    return value;
  }
  return String(value);
}

/** Same as `asIso`, or `null` when the wire value is nullish. */
export function asNullableIso(value: unknown): string | null {
  return value == null ? null : asIso(value);
}
