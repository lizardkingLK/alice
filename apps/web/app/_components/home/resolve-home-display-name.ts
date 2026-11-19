/**
 * Prefer the public.users name; fall back to the email local-part, then a
 * generic salutation so the greeting never reads empty.
 */
export function resolveHomeDisplayName(options: {
  readonly name?: string | null;
  readonly email?: string | null;
}): string {
  const trimmedName = options.name?.trim();
  if (trimmedName) {
    return trimmedName;
  }

  const localPart = options.email?.split('@')[0]?.trim();
  if (localPart) {
    return localPart;
  }

  return 'there';
}
