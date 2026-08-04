import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDbUserMock = vi.hoisted(() => vi.fn());
const toggleUserActiveMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  })
);

vi.mock('@/lib/auth', () => ({
  getDbUser: getDbUserMock,
}));

vi.mock('@/app/users/_services/users.service.server', () => ({
  toggleUserActive: toggleUserActiveMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { signOut: signOutMock },
  })),
}));

vi.mock('@/lib/cache/dropdown-cache', () => ({
  DROPDOWN_CACHE_TAGS: { users: 'users' },
  invalidateDropdownCache: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

import { deactivateMyAccount } from '@/app/edit-profile/_components/actions';

describe('deactivateMyAccount', () => {
  beforeEach(() => {
    getDbUserMock.mockResolvedValue({
      id: 'user-1',
      email: 'pat@example.com',
      role: 'member',
      active: true,
      updated_at: '2026-01-01T00:00:00.000Z',
    });
    toggleUserActiveMock.mockResolvedValue({ id: 'user-1', active: false });
    signOutMock.mockResolvedValue(undefined);
  });

  it('rejects when confirmation email does not match', async () => {
    const formData = new FormData();
    formData.set('confirmation', 'wrong@example.com');
    formData.set('expectedUpdatedAt', '2026-01-01T00:00:00.000Z');

    const result = await deactivateMyAccount(null, formData);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email/i);
    expect(toggleUserActiveMock).not.toHaveBeenCalled();
  });

  it('calls toggle-active then signs out and redirects', async () => {
    const formData = new FormData();
    formData.set('confirmation', 'pat@example.com');
    formData.set('expectedUpdatedAt', '2026-01-01T00:00:00.000Z');

    await expect(deactivateMyAccount(null, formData)).rejects.toThrow(
      'NEXT_REDIRECT:/?account=closed'
    );

    expect(toggleUserActiveMock).toHaveBeenCalledWith(
      'user-1',
      false,
      '2026-01-01T00:00:00.000Z'
    );
    expect(signOutMock).toHaveBeenCalled();
    expect(redirectMock).toHaveBeenCalledWith('/?account=closed');
  });
});
