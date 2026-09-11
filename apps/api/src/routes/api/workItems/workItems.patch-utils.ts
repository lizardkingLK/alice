/**
 * Shared PATCH merge / equality helpers for work-item updates.
 */

/**
 * Prefer an explicit PATCH value (including `null`) over the stored field.
 * Must not use `??` — that would treat intentional `null` clears as "keep current".
 */
export function coalescePatchField<T>(next: T | undefined, current: T): T {
  if (next === undefined) {
    return current;
  }
  return next;
}

/** Nullish-safe equality for optional nullable PATCH fields. */
export function sameNullable<T>(
  left: T | null | undefined,
  right: T | null | undefined
): boolean {
  return (left ?? null) === (right ?? null);
}

export function resolveBoardColumnPatchValue(input: {
  readonly wasProvided: boolean;
  readonly value: string | null | undefined;
  readonly currentValue: string | null;
  readonly workflowContextChanged: boolean;
}): string | null {
  if (input.wasProvided) {
    return input.value ?? null;
  }
  return input.workflowContextChanged ? null : input.currentValue;
}
