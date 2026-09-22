/** Generic credential failure shown on `/login` (including unknown emails). */
export const LOGIN_INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password.';

export const LOGIN_DEACTIVATED_MESSAGE =
  'Your account has been deactivated. Contact your administrator for access.';

/** Map Supabase Auth ban errors to product-friendly login copy. */
export function loginErrorMessage(message: string): string {
  if (/ban/i.test(message)) {
    return LOGIN_DEACTIVATED_MESSAGE;
  }
  if (/invalid login credentials/i.test(message)) {
    return LOGIN_INVALID_CREDENTIALS_MESSAGE;
  }
  return message;
}

/** True when Auth reported invalid credentials (vs ban / other errors). */
export function isInvalidLoginCredentialsError(message: string): boolean {
  return (
    message === LOGIN_INVALID_CREDENTIALS_MESSAGE ||
    /invalid login credentials/i.test(message)
  );
}
