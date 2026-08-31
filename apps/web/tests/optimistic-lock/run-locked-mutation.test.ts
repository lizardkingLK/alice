import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  OPTIMISTIC_LOCK_ERROR_CODE,
  OPTIMISTIC_LOCK_HTTP_STATUS,
} from '@repo/types';
import { ApiError } from '@/lib/api/api-fetch.helper';
import {
  runLockedMutation,
  runLockedMutationOrThrow,
  tryHandleLockedMutationError,
} from '@/lib/optimistic-lock/run-locked-mutation';
import { forceOptimisticPatch } from '@/lib/optimistic-lock/force-patch';

vi.mock('@/lib/optimistic-lock/resolve-user-id', () => ({
  resolveCurrentUserId: vi.fn(async (id?: string | null) => id ?? 'user-1'),
}));

describe('runLockedMutation', () => {
  const handleMutationError = vi.fn();

  beforeEach(() => {
    handleMutationError.mockReset();
  });

  it('returns data on success', async () => {
    const result = await runLockedMutation({
      mutate: async () => ({ id: '1' }),
      handleMutationError,
      entityType: 'work_item',
      entityId: 'wi-1',
      expectedUpdatedAt: '2024-01-01T00:00:00.000Z',
      pendingFields: { title: 'A' },
      currentUserId: 'user-1',
    });

    expect(result).toEqual({ ok: true, data: { id: '1' } });
    expect(handleMutationError).not.toHaveBeenCalled();
  });

  it('returns conflict when handleMutationError handles the error', async () => {
    handleMutationError.mockReturnValue(true);
    const conflict = new ApiError('conflict', OPTIMISTIC_LOCK_HTTP_STATUS, {
      code: OPTIMISTIC_LOCK_ERROR_CODE,
      serverEntity: { id: 'wi-1' },
    });

    const result = await runLockedMutation({
      mutate: async () => {
        throw conflict;
      },
      handleMutationError,
      entityType: 'work_item',
      entityId: 'wi-1',
      expectedUpdatedAt: '2024-01-01T00:00:00.000Z',
      pendingFields: { title: 'A' },
      currentUserId: 'user-1',
    });

    expect(result).toEqual({ ok: false, conflict: true });
    expect(handleMutationError).toHaveBeenCalled();
  });

  it('rethrows via OrThrow when not a handled conflict', async () => {
    handleMutationError.mockReturnValue(false);
    await expect(
      runLockedMutationOrThrow({
        mutate: async () => {
          throw new Error('network');
        },
        handleMutationError,
        entityType: 'work_item',
        entityId: 'wi-1',
        expectedUpdatedAt: '2024-01-01T00:00:00.000Z',
        pendingFields: {},
        currentUserId: 'user-1',
      })
    ).rejects.toThrow('network');
  });

  it('tryHandleLockedMutationError delegates to handleMutationError', async () => {
    handleMutationError.mockReturnValue(true);
    const handled = await tryHandleLockedMutationError({
      error: new Error('x'),
      handleMutationError,
      entityType: 'project',
      entityId: 'p-1',
      expectedUpdatedAt: '2024-01-01T00:00:00.000Z',
      pendingFields: { name: 'N' },
      currentUserId: 'user-1',
    });
    expect(handled).toBe(true);
  });
});

describe('forceOptimisticPatch', () => {
  it('PUTs pending fields with expectedUpdatedAt', async () => {
    const apiFetch = vi.fn(async () => ({
      project: { id: 'p-1' },
    })) as unknown as Parameters<typeof forceOptimisticPatch>[0];
    const data = await forceOptimisticPatch<{ project: { id: string } }>(
      apiFetch,
      '/api/projects/p-1',
      {
        pendingFields: { name: 'Mine' },
        expectedUpdatedAt: '2024-01-01T00:00:00.000Z',
      }
    );

    expect(data.project.id).toBe('p-1');
    expect(apiFetch).toHaveBeenCalledWith('/api/projects/p-1', {
      method: 'PUT',
      body: JSON.stringify({
        name: 'Mine',
        expectedUpdatedAt: '2024-01-01T00:00:00.000Z',
      }),
    });
  });
});
