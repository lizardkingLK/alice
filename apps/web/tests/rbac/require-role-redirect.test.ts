import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tables } from '@repo/types';

const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);

const getDbUserMock = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('@/lib/auth', () => ({
  getDbUser: getDbUserMock,
}));

import {
  assertAdminOrRedirect,
  assertManagerOrRedirect,
} from '@/lib/rbac/require-role';

function userWithRole(role: Tables<'users'>['role']): Tables<'users'> {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    role,
    active: true,
    status: 'active',
    profile_picture: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    created_by: null,
    updated_by: null,
  };
}

describe('rbac layout redirects', () => {
  beforeEach(() => {
    redirectMock.mockClear();
    getDbUserMock.mockReset();
  });

  it('redirects non-admin away from admin routes', async () => {
    getDbUserMock.mockResolvedValue(userWithRole('manager'));

    await expect(assertAdminOrRedirect()).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard'
    );
    expect(redirectMock).toHaveBeenCalledWith('/dashboard');
  });

  it('allows admin through admin routes', async () => {
    getDbUserMock.mockResolvedValue(userWithRole('admin'));

    await expect(assertAdminOrRedirect()).resolves.toMatchObject({
      role: 'admin',
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redirects member away from manager routes', async () => {
    getDbUserMock.mockResolvedValue(userWithRole('member'));

    await expect(assertManagerOrRedirect()).rejects.toThrow(
      'NEXT_REDIRECT:/dashboard'
    );
    expect(redirectMock).toHaveBeenCalledWith('/dashboard');
  });

  it('allows manager through manager routes', async () => {
    getDbUserMock.mockResolvedValue(userWithRole('manager'));

    await expect(assertManagerOrRedirect()).resolves.toMatchObject({
      role: 'manager',
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('redirects unauthenticated users to login', async () => {
    getDbUserMock.mockResolvedValue(null);

    await expect(assertAdminOrRedirect()).rejects.toThrow(
      'NEXT_REDIRECT:/login'
    );
    expect(redirectMock).toHaveBeenCalledWith('/login');
  });
});
