/** Resolve a user-facing message from an unknown catch value. */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}
