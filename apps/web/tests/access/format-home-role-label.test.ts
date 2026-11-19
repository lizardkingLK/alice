import { describe, expect, it } from 'vitest';
import { formatHomeRoleLabel } from '@/app/_components/home/format-home-role-label';

describe('formatHomeRoleLabel', () => {
  it('maps known roles and ignores unknowns', () => {
    expect(formatHomeRoleLabel('admin')).toBe('Administrator');
    expect(formatHomeRoleLabel('manager')).toBe('Manager');
    expect(formatHomeRoleLabel('member')).toBe('Member');
    expect(formatHomeRoleLabel('  ADMIN ')).toBe('Administrator');
    expect(formatHomeRoleLabel(null)).toBeNull();
    expect(formatHomeRoleLabel('other')).toBeNull();
  });
});
