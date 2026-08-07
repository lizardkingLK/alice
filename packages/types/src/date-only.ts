/** UTC calendar day as `YYYY-MM-DD`. */
export function todayDateString(now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Normalize DB/ISO timestamps to `YYYY-MM-DD` for comparisons. */
export function toDateOnly(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.split('T')[0] ?? null;
}
