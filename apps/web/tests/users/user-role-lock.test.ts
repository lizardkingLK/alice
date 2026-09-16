import { describe, expect, it } from 'vitest';
import { resolveUserRoleLock } from '@/app/users/_helpers/user-role-lock';

describe('resolveUserRoleLock', () => {
  it('allows role changes when creating a user', () => {
    expect(
      resolveUserRoleLock({
        isEdit: false,
        targetUserId: undefined,
        targetRole: undefined,
        currentUserId: 'admin-1',
        activeAdminCount: 1,
      })
    ).toEqual({ locked: false, reason: null });
  });

  it('locks self-edits even when other admins exist', () => {
    const result = resolveUserRoleLock({
      isEdit: true,
      targetUserId: 'admin-1',
      targetRole: 'admin',
      currentUserId: 'admin-1',
      activeAdminCount: 2,
    });
    expect(result.locked).toBe(true);
    expect(result.reason).toMatch(/own workspace role/i);
  });

  it('locks the sole active admin with a coverage message', () => {
    const result = resolveUserRoleLock({
      isEdit: true,
      targetUserId: 'admin-1',
      targetRole: 'admin',
      currentUserId: 'admin-1',
      activeAdminCount: 1,
    });
    expect(result.locked).toBe(true);
    expect(result.reason).toMatch(/only admin/i);
  });

  it('allows editing another user when multiple admins exist', () => {
    expect(
      resolveUserRoleLock({
        isEdit: true,
        targetUserId: 'admin-2',
        targetRole: 'admin',
        currentUserId: 'admin-1',
        activeAdminCount: 2,
      })
    ).toEqual({ locked: false, reason: null });
  });
});
