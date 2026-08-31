import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveUserOptimisticConflict } from '@/lib/optimistic-lock/resolve-user-conflict';

const { toggleUserActiveMock, forceUpdateUserMock, apiFetchMock } = vi.hoisted(
  () => ({
    toggleUserActiveMock: vi.fn(),
    forceUpdateUserMock: vi.fn(),
    apiFetchMock: vi.fn(),
  })
);

vi.mock('@/app/users/_services/users.mutations.client', () => ({
  toggleUserActive: toggleUserActiveMock,
  forceUpdateUser: forceUpdateUserMock,
}));

vi.mock('@/lib/api/api-fetch.mutations.use.client', () => ({
  apiFetch: apiFetchMock,
}));

describe('resolveUserOptimisticConflict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('routes active toggles to toggleUserActive', async () => {
    await resolveUserOptimisticConflict('user-1', { active: true }, 'ts-1');

    expect(toggleUserActiveMock).toHaveBeenCalledWith('user-1', true, 'ts-1');
    expect(forceUpdateUserMock).not.toHaveBeenCalled();
    expect(apiFetchMock).not.toHaveBeenCalled();
  });

  it('routes admin role edits to forceUpdateUser', async () => {
    await resolveUserOptimisticConflict(
      'user-1',
      { name: 'Pat', role: 'admin' },
      'ts-1'
    );

    expect(forceUpdateUserMock).toHaveBeenCalledWith(
      'user-1',
      { name: 'Pat', role: 'admin' },
      'ts-1'
    );
  });

  it('routes self profile name edits to profile PATCH', async () => {
    await resolveUserOptimisticConflict('user-1', { name: 'Pat' }, 'ts-1');

    expect(apiFetchMock).toHaveBeenCalledWith('/api/profile', {
      method: 'PATCH',
      body: JSON.stringify({ name: 'Pat', expectedUpdatedAt: 'ts-1' }),
    });
  });
});
