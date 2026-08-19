/**
 * GoTrue (email confirmation on) does not error on a second sign-up for the
 * same address. It returns a user with an empty `identities` array so callers
 * cannot enumerate registered emails.
 *
 * The signup UI must use the same generic copy for new and existing emails.
 * Existing accounts get a recovery email (same as forgot-password) so the
 * owner still has a next step without the page admitting the address is taken.
 */
export const SIGNUP_CHECK_EMAIL_MESSAGE =
  'If this email is valid, we sent a message with the next steps.';

export function isObfuscatedDuplicateSignup(user: {
  identities?: unknown[] | null;
}): boolean {
  return Array.isArray(user.identities) && user.identities.length === 0;
}

export function isExistingAccountAuthError(message: string): boolean {
  return /already registered|already exists|user already/i.test(message);
}
