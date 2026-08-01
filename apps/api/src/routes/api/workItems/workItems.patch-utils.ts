/**
 * Shared PATCH merge / equality helpers for work-item updates.
 */

/** Prefer an explicit PATCH value (including `null`) over the stored field. */
export function coalescePatchField<T>(next: T | undefined, current: T): T {
  return next !== undefined ? next : current;
}

/** Nullish-safe equality for optional nullable PATCH fields. */
export function sameNullable<T>(
  left: T | null | undefined,
  right: T | null | undefined
): boolean {
  return (left ?? null) === (right ?? null);
}
