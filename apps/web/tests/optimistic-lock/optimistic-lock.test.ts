import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  clearOptimisticPending,
  optimisticPendingStorageKey,
  readOptimisticPending,
  upsertOptimisticPendingFields,
  writeOptimisticPending,
} from '@/lib/optimistic-lock/pending-storage';
import {
  OptimisticLockClientError,
  isOptimisticLockClientError,
  parseOptimisticLockFromApiError,
} from '@/lib/optimistic-lock/errors';
import { ApiError } from '@/lib/api/api';
import {
  OPTIMISTIC_LOCK_ERROR_CODE,
  OPTIMISTIC_LOCK_HTTP_STATUS,
} from '@repo/types';

describe('optimistic pending storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('writes and reads pending edited fields only', () => {
    const wrote = writeOptimisticPending({
      entityType: 'work_item',
      entityId: 'wi-1',
      userId: 'user-1',
      baseUpdatedAt: '2024-01-01T00:00:00.000Z',
      pendingFields: { title: 'Mine' },
      savedAt: '2024-01-01T00:00:01.000Z',
    });

    expect(wrote).toBe(true);
    expect(
      readOptimisticPending('work_item', 'wi-1', 'user-1')?.pendingFields
    ).toEqual({ title: 'Mine' });
    expect(optimisticPendingStorageKey('work_item', 'wi-1', 'user-1')).toBe(
      'alice:optimistic-pending:work_item:wi-1:user-1'
    );
  });

  it('merges dirty fields on upsert and clears on success path', () => {
    upsertOptimisticPendingFields({
      entityType: 'work_item',
      entityId: 'wi-1',
      userId: 'user-1',
      baseUpdatedAt: '2024-01-01T00:00:00.000Z',
      pendingFields: { title: 'A' },
    });
    upsertOptimisticPendingFields({
      entityType: 'work_item',
      entityId: 'wi-1',
      userId: 'user-1',
      baseUpdatedAt: '2024-01-01T00:00:00.000Z',
      pendingFields: { status: 'Done' },
    });

    expect(
      readOptimisticPending('work_item', 'wi-1', 'user-1')?.pendingFields
    ).toEqual({ title: 'A', status: 'Done' });

    clearOptimisticPending('work_item', 'wi-1', 'user-1');
    expect(readOptimisticPending('work_item', 'wi-1', 'user-1')).toBeNull();
  });
});

describe('optimistic lock client errors', () => {
  it('parses ApiError 409 OPTIMISTIC_LOCK into OptimisticLockClientError', () => {
    const serverEntity = {
      id: 'wi-1',
      updated_at: '2024-01-02T00:00:00.000Z',
      title: 'Theirs',
    };
    const apiError = new ApiError('conflict', OPTIMISTIC_LOCK_HTTP_STATUS, {
      code: OPTIMISTIC_LOCK_ERROR_CODE,
      serverEntity,
    });

    const parsed = parseOptimisticLockFromApiError(apiError, {
      entityType: 'work_item',
      entityId: 'wi-1',
      pendingFields: { title: 'Mine' },
      baseUpdatedAt: '2024-01-01T00:00:00.000Z',
    });

    expect(parsed).toBeInstanceOf(OptimisticLockClientError);
    expect(isOptimisticLockClientError(parsed)).toBe(true);
    expect(parsed?.serverEntity).toEqual(serverEntity);
  });

  it('returns null when ApiError is not an optimistic lock conflict', () => {
    const apiError = new ApiError('nope', 400);
    expect(
      parseOptimisticLockFromApiError(apiError, {
        entityType: 'work_item',
        entityId: 'wi-1',
        pendingFields: {},
        baseUpdatedAt: '2024-01-01T00:00:00.000Z',
      })
    ).toBeNull();
  });
});

describe('conflict resolution pending fields', () => {
  it('keeps only chosen mine fields for merge apply', () => {
    const pendingFields = { title: 'Mine', status: 'Done' };
    const choices: Record<string, 'mine' | 'theirs'> = {
      title: 'mine',
      status: 'theirs',
    };
    const merged: Record<string, unknown> = {};
    for (const key of Object.keys(pendingFields)) {
      if (choices[key] === 'mine') {
        merged[key] = pendingFields[key as keyof typeof pendingFields];
      }
    }
    expect(merged).toEqual({ title: 'Mine' });
  });
});
