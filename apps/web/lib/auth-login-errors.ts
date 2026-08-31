/** Map Supabase Auth ban errors to a product-friendly deactivated message. */
export function loginErrorMessage(message: string): string {
  if (/ban/i.test(message)) {
    return 'Your account has been deactivated. Contact your administrator for access.';
  }
  return message;
}
