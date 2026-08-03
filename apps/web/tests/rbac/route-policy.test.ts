import { describe, expect, it } from 'vitest';
import {
  canAccessNavGroup,
  canAccessPath,
  isAdmin,
  isManagerOrAdmin,
  minimumRoleForPath,
  roleAtLeast,
} from '@/lib/rbac';

describe('rbac roles', () => {
  it('ranks member < manager < admin', () => {
    expect(roleAtLeast('member', 'member')).toBe(true);
    expect(roleAtLeast('member', 'manager')).toBe(false);
    expect(roleAtLeast('manager', 'manager')).toBe(true);
    expect(roleAtLeast('manager', 'admin')).toBe(false);
    expect(roleAtLeast('admin', 'manager')).toBe(true);
    expect(roleAtLeast('admin', 'admin')).toBe(true);
  });

  it('detects admin and manager-or-admin', () => {
    expect(isAdmin('admin')).toBe(true);
    expect(isAdmin('manager')).toBe(false);
    expect(isManagerOrAdmin('admin')).toBe(true);
    expect(isManagerOrAdmin('manager')).toBe(true);
    expect(isManagerOrAdmin('member')).toBe(false);
  });
});

describe('rbac route policy', () => {
  it('maps path prefixes to minimum roles', () => {
    expect(minimumRoleForPath('/users')).toBe('admin');
    expect(minimumRoleForPath('/users/edit')).toBe('admin');
    expect(minimumRoleForPath('/projects')).toBe('manager');
    expect(minimumRoleForPath('/projects/abc')).toBe('manager');
    expect(minimumRoleForPath('/sprints')).toBe('manager');
    expect(minimumRoleForPath('/manager')).toBe('manager');
    expect(minimumRoleForPath('/dashboard')).toBeNull();
    expect(minimumRoleForPath('/backlog')).toBeNull();
  });

  it('allows path access per phase-1 matrix', () => {
    expect(canAccessPath('admin', '/users')).toBe(true);
    expect(canAccessPath('manager', '/users')).toBe(false);
    expect(canAccessPath('member', '/users')).toBe(false);

    expect(canAccessPath('admin', '/projects')).toBe(true);
    expect(canAccessPath('manager', '/sprints')).toBe(true);
    expect(canAccessPath('member', '/manager')).toBe(false);

    expect(canAccessPath('member', '/dashboard')).toBe(true);
    expect(canAccessPath(null, '/dashboard')).toBe(false);
  });

  it('gates sidebar nav groups', () => {
    expect(canAccessNavGroup('admin', 'system')).toBe(true);
    expect(canAccessNavGroup('manager', 'system')).toBe(false);
    expect(canAccessNavGroup('member', 'system')).toBe(false);

    expect(canAccessNavGroup('admin', 'projects')).toBe(true);
    expect(canAccessNavGroup('manager', 'projects')).toBe(true);
    expect(canAccessNavGroup('member', 'projects')).toBe(false);

    expect(canAccessNavGroup('member', 'platform')).toBe(true);
  });
});
