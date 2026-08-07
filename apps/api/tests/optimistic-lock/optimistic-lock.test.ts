import { describe, expect, it, vi } from 'vitest';
import {
  OPTIMISTIC_LOCK_ERROR_CODE,
  OPTIMISTIC_LOCK_HTTP_STATUS,
} from '@repo/types';
import {
  OptimisticLockError,
  isOptimisticLockError,
  resolveOptimisticUpdate,
  sendRouteMutationError,
  trySendOptimisticLockError,
} from '../../src/lib/optimistic-lock.js';

describe('resolveOptimisticUpdate', () => {
  it('returns data when the conditional update matched a row', async () => {
    const row = { id: '1', updated_at: '2024-01-02T00:00:00.000Z' };
    await expect(
      resolveOptimisticUpdate({
        data: row,
        error: null,
        fetchCurrent: async () => null,
      })
    ).resolves.toEqual(row);
  });

  it('throws OptimisticLockError with the current row when zero rows matched', async () => {
    const current = { id: '1', updated_at: '2024-01-03T00:00:00.000Z' };
    await expect(
      resolveOptimisticUpdate({
        data: null,
        error: null,
        fetchCurrent: async () => current,
      })
    ).rejects.toMatchObject({
      code: OPTIMISTIC_LOCK_ERROR_CODE,
      httpStatus: OPTIMISTIC_LOCK_HTTP_STATUS,
      serverEntity: current,
    });
  });

  it('throws a not-found error when the row is gone', async () => {
    await expect(
      resolveOptimisticUpdate({
        data: null,
        error: null,
        fetchCurrent: async () => null,
        notFoundMessage: 'Work item not found',
      })
    ).rejects.toThrow('Work item not found');
  });
});

describe('trySendOptimisticLockError', () => {
  it('sends 409 OPTIMISTIC_LOCK body for OptimisticLockError', () => {
    const serverEntity = { id: 'wi-1', title: 'Server title' };
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const handled = trySendOptimisticLockError(
      { status },
      new OptimisticLockError(serverEntity)
    );

    expect(handled).toBe(true);
    expect(status).toHaveBeenCalledWith(OPTIMISTIC_LOCK_HTTP_STATUS);
    expect(json).toHaveBeenCalledWith({
      code: OPTIMISTIC_LOCK_ERROR_CODE,
      error: 'This record was updated by someone else.',
      serverEntity,
    });
  });

  it('returns false for unrelated errors', () => {
    expect(
      trySendOptimisticLockError({ status: vi.fn() }, new Error('x'))
    ).toBe(false);
    expect(isOptimisticLockError(new Error('x'))).toBe(false);
  });
});

describe('sendRouteMutationError', () => {
  it('delegates optimistic lock conflicts to 409', () => {
    const serverEntity = { id: '1' };
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    sendRouteMutationError(
      { status },
      new OptimisticLockError(serverEntity),
      'fallback'
    );
    expect(status).toHaveBeenCalledWith(OPTIMISTIC_LOCK_HTTP_STATUS);
    expect(json).toHaveBeenCalledWith({
      code: OPTIMISTIC_LOCK_ERROR_CODE,
      error: 'This record was updated by someone else.',
      serverEntity,
    });
  });

  it('sends 500 with message for other errors', () => {
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    sendRouteMutationError({ status }, new Error('boom'), 'fallback');
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ error: 'boom' });
  });
});
