/**
 * Shared identity helpers for `/profile` and `/edit-profile` data loaders.
 */

export function metadataString(
  metadata: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return null;
}

/** Local-part handle without `@` (e.g. `asmith`). */
export function handleFromEmail(email: string): string {
  const local = email.split('@')[0]?.trim() ?? '';
  return local || 'user';
}

/** Display handle with `@` prefix (e.g. `@asmith`). */
export function displayHandleFromEmail(email: string): string {
  return `@${handleFromEmail(email)}`;
}
