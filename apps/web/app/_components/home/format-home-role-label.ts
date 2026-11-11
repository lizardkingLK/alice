/** Human-readable workspace role for the signed-in home greeting. */
export function formatHomeRoleLabel(
  role: string | null | undefined
): string | null {
  const normalized = role?.trim().toLowerCase();
  if (normalized === 'admin') {
    return 'Administrator';
  }
  if (normalized === 'manager') {
    return 'Manager';
  }
  if (normalized === 'member') {
    return 'Member';
  }
  return null;
}
